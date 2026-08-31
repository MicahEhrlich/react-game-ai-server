import type { GameMode } from '../state/types.ts'
import { ALL_MODES, MODE_LABEL } from '../state/types.ts'
import {
  CHAOS_LABEL,
  CHAOS_UNLOCK_SHIFT,
  clampModifiers,
  DEFAULT_MODIFIERS,
} from './modifiers.ts'
import type { ChaosFlag } from './modifiers.ts'
import { getPacing } from './pacing.ts'
import type {
  Director,
  DirectorHistory,
  ModifierDraft,
  RunMetrics,
  StageModifiers,
  StagePlan,
} from './types.ts'

/**
 * The runtime Game Director, as a deterministic rules engine.
 *
 * It is deliberately synchronous and offline: a stage plan must exist by the
 * time the glitch overlay lifts, and a difficulty system that can stall or
 * fail is worse than one that is merely simple. An LLM-backed Director
 * implements the same interface and, because clampModifiers() sits between
 * any director and the game, cannot produce an unplayable stage either.
 *
 * Every rule below also appends a short note, which the glitch overlay shows
 * the player -- the adaptation is meant to be legible, not mysterious.
 */

/** Accuracy above this reads as "this player has the shooter solved". */
const ACCURACY_HIGH = 0.7
const ACCURACY_LOW = 0.35
/** Damage per minute above this reads as "this player is drowning". */
const DPM_HIGH = 45
const HEALTH_MERCY = 0.3
const CHAOS_STABLE_CHANCE = 0.45
const WEIGHTED_CHAOS_FLAGS: readonly ChaosFlag[] = [
  'mirrorWorld',
  'invertControls',
  'mirrorWorld',
  'fogOfWar',
]

export class HeuristicDirector implements Director {
  /** Injectable so validate-director can make runs reproducible.
   *  Declared explicitly: `erasableSyntaxOnly` bans parameter properties. */
  private readonly random: () => number

  constructor(random: () => number = Math.random) {
    this.random = random
  }

  decide(m: RunMetrics, history: DirectorHistory): StagePlan {
    const mode = this.pickMode(m, history)
    const { modifiers, notes } = this.pickModifiers(m, history)
    return {
      mode,
      modifiers,
      notes: [`NEXT: ${MODE_LABEL[mode]}`, ...notes],
    }
  }

  /**
   * Never the same mode twice in a row, and weighted toward the mode the
   * player scores worst in -- an adaptive director should be pushing at the
   * weak spot, not replaying the comfortable one. Modes never played get the
   * highest weight of all, so a run reaches all three quickly.
   */
  private pickMode(m: RunMetrics, history: DirectorHistory): GameMode {
    const candidates = ALL_MODES.filter((x) => x !== history.currentMode)

    const rates = candidates.map((mode) => {
      const ms = m.msPerMode[mode]
      // Unplayed modes: weight above anything a played mode can earn.
      return ms > 1000 ? { mode, ms } : { mode, ms: 0 }
    })

    const unplayed = rates.filter((r) => r.ms === 0)
    const pool = unplayed.length > 0 ? unplayed : rates

    // Weight inversely by time spent: the less a mode has been played, the
    // more likely it is next.
    const totalMs = pool.reduce((sum, r) => sum + r.ms, 0)
    const weights = pool.map((r) => (totalMs === 0 ? 1 : 1 + (totalMs - r.ms) / totalMs))
    const roll = this.random() * weights.reduce((a, b) => a + b, 0)

    let acc = 0
    for (const [i, w] of weights.entries()) {
      acc += w
      if (roll <= acc) return pool[i].mode
    }
    return pool[pool.length - 1].mode
  }

  private pickModifiers(
    m: RunMetrics,
    history: DirectorHistory,
  ): { modifiers: StageModifiers; notes: string[] } {
    const notes: string[] = []
    const next: ModifierDraft = { ...DEFAULT_MODIFIERS }

    const minutes = Math.max(m.windowMs, 1) / 60_000
    const dpm = m.damageTaken / minutes
    const accuracy = m.shotsFired > 0 ? m.shotsHit / m.shotsFired : null

    // --- pressure up: the player is handling it -----------------------
    if (accuracy !== null && accuracy > ACCURACY_HIGH) {
      next.spawnRateScale = 1.45
      next.projectileSpeedScale = 1.25
      notes.push(`ACCURACY ${Math.round(accuracy * 100)}% — MORE TARGETS`)
    } else if (accuracy !== null && accuracy < ACCURACY_LOW) {
      next.projectileSpeedScale = 0.85
      notes.push('TRACKING EASED')
    }

    // --- pressure down: the player is drowning ------------------------
    if (dpm > DPM_HIGH) {
      next.spawnRateScale = Math.min(next.spawnRateScale ?? 1, 0.75)
      next.gravityScale = 1 // stop compounding a movement modifier on top
      notes.push('DAMAGE HIGH — PRESSURE REDUCED')
    }

    // --- mercy: low health outranks everything above ------------------
    if (m.healthFraction < HEALTH_MERCY) {
      next.spawnRateScale = 0.7
      next.projectileSpeedScale = 0.8
      next.scoreMultiplier = 1.2
      notes.push('CRITICAL — MERCY PROTOCOL, x1.2 SCORE')
    }

    // --- spice: glitches once the player has a baseline ----------------
    // Chaos used to be a flawless-only reward, which made WORLD MIRRORED easy
    // to miss: one of three flags behind a perfect-stage gate. Keep the same
    // structural safety gates, but let stable runs glitch too.
    const earnedChaos = m.damageTaken === 0 && m.healthFraction > HEALTH_MERCY
    const stableEnoughForChaos = m.healthFraction > HEALTH_MERCY && dpm <= DPM_HIGH
    const chaosAllowed =
      !history.chaosLastStage && history.shiftIndex >= CHAOS_UNLOCK_SHIFT

    const shouldChaos =
      chaosAllowed &&
      (earnedChaos || (stableEnoughForChaos && this.random() < CHAOS_STABLE_CHANCE))

    if (shouldChaos) {
      const flag = WEIGHTED_CHAOS_FLAGS[Math.floor(this.random() * WEIGHTED_CHAOS_FLAGS.length)]
      next[flag] = true
      next.scoreMultiplier = earnedChaos ? 1.5 : 1.35
      notes.push(
        earnedChaos
          ? `FLAWLESS — ${CHAOS_LABEL[flag]}, x1.5 SCORE`
          : `GLITCH WINDOW — ${CHAOS_LABEL[flag]}, x1.35 SCORE`,
      )
    } else if (earnedChaos) {
      next.scoreMultiplier = 1.25
      notes.push('FLAWLESS — x1.25 SCORE')
    }

    // --- pacing: stages shorten as the run gets deeper -----------------
    // Every number here comes from public/config/pacing.json. Defaults taper
    // 30s down to 18s, keeping the mean stage around 20s -- asserted by the
    // pacing check in validate-director.
    const pacing = getPacing()
    next.shiftDurationMs =
      pacing.baseStageMs -
      Math.min(history.shiftIndex, pacing.taperShifts) * pacing.taperPerShiftMs

    if (notes.length === 0) notes.push('PARAMETERS HOLDING')

    return { modifiers: clampModifiers(next), notes }
  }
}
