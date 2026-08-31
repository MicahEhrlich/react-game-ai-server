import { ALL_MODES } from '../state/types.ts'
import { DEFAULT_PACING, getPacing } from './pacing.ts'
import type { ModifierDraft, StageModifiers } from './types.ts'

export const DEFAULT_MODIFIERS: StageModifiers = {
  gravityScale: 1,
  playerSpeedScale: 1,
  spawnRateScale: 1,
  projectileSpeedScale: 1,
  scoreMultiplier: 1,
  invertControls: false,
  mirrorWorld: false,
  fogOfWar: false,
  // Only a shape default. The live value comes from pacing.ts, which is fed by
  // public/config/pacing.json -- see clampStageMs below.
  shiftDurationMs: DEFAULT_PACING.firstStageMs,
}

/**
 * Player-facing names for the chaos flags. Lives here rather than in the
 * director because both the director's notes and the HUD badge need it, and a
 * second copy would drift.
 */
export const CHAOS_LABEL = {
  invertControls: 'CONTROLS INVERTED',
  mirrorWorld: 'WORLD MIRRORED',
  fogOfWar: 'SIGNAL DEGRADED',
} as const
export type ChaosFlag = keyof typeof CHAOS_LABEL

export const CHAOS_FLAGS: readonly ChaosFlag[] = [
  'invertControls',
  'mirrorWorld',
  'fogOfWar',
]

/**
 * Chaos flags stay locked until this shift. Inverting a new player's controls
 * during their second stage does not read as an escalation they earned -- it
 * reads as the game being broken. The player needs ONE FULL SWEEP of the modes
 * first, so they have a baseline to notice the change against.
 *
 * Derived from the mode count, not a literal: "one sweep" is the actual rule,
 * and a hardcoded 3 was only ever the right number while there happened to be
 * exactly three modes. A fourth mode would have silently under-protected new
 * players, which is the one failure this constant exists to prevent.
 *
 * Lives here rather than in HeuristicDirector because every director path has
 * to honour it: the heuristic applies it when choosing, and llmPlan.ts
 * re-applies it when validating a model's plan. Two copies would drift, and
 * the drift would surface as exactly the "game is broken" reading above.
 */
export const CHAOS_UNLOCK_SHIFT = ALL_MODES.length

/**
 * Hard playability bounds. Every numeric modifier is clamped to these before
 * it can reach a scene -- this is the guard that stops a bad decision from
 * producing an unplayable stage, and it matters most for a future LLM-backed
 * director whose output cannot be trusted the way the heuristic's can.
 */
const RANGE: Readonly<Record<string, readonly [number, number]>> = {
  gravityScale: [0.5, 1.6],
  playerSpeedScale: [0.7, 1.4],
  spawnRateScale: [0.5, 2.0],
  projectileSpeedScale: [0.6, 1.8],
  scoreMultiplier: [1, 3],
  // shiftDurationMs is NOT here -- its bounds are configurable and live in
  // pacing.ts. See clampStageMs.
}

function clampNumber(key: keyof typeof RANGE, value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  const [lo, hi] = RANGE[key]
  return Math.min(hi, Math.max(lo, value))
}

/**
 * Stage length is clamped against the LIVE pacing config rather than a literal
 * range, so `public/config/pacing.json` governs every path into a stage --
 * the director, the server override, and the ?mods= dev override alike.
 */
function clampStageMs(value: number): number {
  const p = getPacing()
  if (!Number.isFinite(value)) return p.firstStageMs
  return Math.min(p.maxStageMs, Math.max(p.minStageMs, value))
}

/**
 * Merges a partial over the defaults and forces the result into range. Also
 * enforces the "at most one chaos flag" rule, in flag-priority order, so no
 * caller can stack inverted controls on top of a mirrored, fogged world.
 */
export function clampModifiers(partial: ModifierDraft): StageModifiers {
  const merged = { ...DEFAULT_MODIFIERS, ...partial }

  // Priority order: the first flag set wins, the rest are dropped.
  const invertControls = merged.invertControls === true
  const mirrorWorld = !invertControls && merged.mirrorWorld === true
  const fogOfWar = !invertControls && !mirrorWorld && merged.fogOfWar === true

  return {
    gravityScale: clampNumber('gravityScale', merged.gravityScale, 1),
    playerSpeedScale: clampNumber('playerSpeedScale', merged.playerSpeedScale, 1),
    spawnRateScale: clampNumber('spawnRateScale', merged.spawnRateScale, 1),
    projectileSpeedScale: clampNumber(
      'projectileSpeedScale',
      merged.projectileSpeedScale,
      1,
    ),
    scoreMultiplier: clampNumber('scoreMultiplier', merged.scoreMultiplier, 1),
    invertControls,
    mirrorWorld,
    fogOfWar,
    shiftDurationMs: clampStageMs(merged.shiftDurationMs),
  }
}

/** True if any chaos flag is set -- used for the "never twice in a row" rule. */
export function hasChaosFlag(m: StageModifiers): boolean {
  return m.invertControls || m.mirrorWorld || m.fogOfWar
}

/**
 * Which chaos flag is active, if any. clampModifiers guarantees at most one,
 * so returning a single value rather than a list is safe by construction.
 */
export function activeChaos(m: StageModifiers): ChaosFlag | null {
  return CHAOS_FLAGS.find((f) => m[f]) ?? null
}
