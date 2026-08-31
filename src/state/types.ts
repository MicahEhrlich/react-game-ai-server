import type { ChaosFlag } from '../director/modifiers.ts'
import type { PlanSource } from '../director/types.ts'
import type { MemeTheme } from '../memeTheme/index.ts'

/**
 * The microgame modes. `erasableSyntaxOnly` bans TS enums, so this is the
 * `as const` object + indexed-union idiom used throughout the codebase.
 *
 * Adding one here is the start of a trail the compiler walks you down: every
 * Record<GameMode, ...> below and in keys.ts / config.ts becomes an error
 * until it is filled in, and `npm run validate-modes` covers the handful of
 * places no type can reach.
 */
export const MODE = {
  Platformer: 'platformer',
  Shooter: 'shooter',
  Runner: 'runner',
  Brick: 'brick',
} as const
export type GameMode = (typeof MODE)[keyof typeof MODE]

/**
 * DERIVED from MODE, never hand-listed.
 *
 * This used to be a literal array, and it was the single most dangerous line
 * in the codebase for adding a mode: omitting an entry compiled perfectly and
 * the mode simply ceased to exist -- never picked by either director, rejected
 * by llmPlan's validation, unreachable via ?mode=. Every other omission at
 * least broke loudly somewhere.
 */
export const ALL_MODES: readonly GameMode[] = Object.values(MODE)

/**
 * The player-facing name. Keep it to 9 characters or fewer -- it renders in
 * the HUD's mode slot and as the glitch overlay's headline, and
 * `npm run validate-modes` fails the build if it grows past that.
 */
export const MODE_LABEL: Readonly<Record<GameMode, string>> = {
  [MODE.Platformer]: 'PLATFORM',
  [MODE.Shooter]: 'STARFIGHT',
  [MODE.Runner]: 'OVERDRIVE',
  // 9 chars, ties STARFIGHT for the longest -- both the wall breaking down
  // and the machine breaking down, matching the double meaning every other
  // label carries.
  [MODE.Brick]: 'BREAKDOWN',
}

/**
 * One line per mode, written for the Director's system prompt so the model
 * knows what it is choosing between.
 *
 * A Record rather than prose inside directorPrompt.ts, so a new mode CANNOT
 * ship undescribed -- previously the prompt listed the modes by hand, and a
 * mode missing from that list was one the model would pick blind and then
 * write wrong-flavour taunts about, with nothing anywhere to flag it.
 *
 * Build-time constant text only. It is interpolated into SYSTEM, and the
 * prompt-cache contract requires SYSTEM to be byte-identical on every request
 * -- "frozen" means "never varies at runtime", not "never computed".
 */
export const MODE_BLURB: Readonly<Record<GameMode, string>> = {
  [MODE.Platformer]:
    'run and jump across procedural terrain with pits, spikes, fire, walkers and flyers. Rewards patience.',
  [MODE.Shooter]: 'zero-gravity wave shooter. The only mode that measures accuracy.',
  [MODE.Runner]:
    'auto-scrolling. Jump the low blocks, slide the gates. Rewards reaction time.',
  [MODE.Brick]:
    'break the wall with a paddle and a ball. Rewards precision and nerve.',
}

export const PHASE = {
  Menu: 'menu',
  Playing: 'playing',
  /** Mid-transition: the glitch overlay is up and input is frozen. */
  Shifting: 'shifting',
  Paused: 'paused',
  GameOver: 'game-over',
} as const
export type GamePhase = (typeof PHASE)[keyof typeof PHASE]

export function acceptsGameplayDamage(phase: GamePhase): boolean {
  return phase === PHASE.Playing
}

/**
 * Discrete, low-frequency state only. NOTHING per-frame goes in here -- every
 * patch() notifies React through useSyncExternalStore.
 *
 * `secondsToShift` is the one derived-from-per-frame value, and it is
 * deliberately quantised to whole seconds before it reaches the store, so the
 * countdown costs one re-render per second rather than one per frame.
 */
export interface GameSnapshot {
  readonly phase: GamePhase
  readonly score: number
  readonly health: number
  readonly maxHealth: number
  /** Score multiplier, grows with clean play, resets on damage. */
  readonly multiplier: number
  readonly mode: GameMode
  /** Populated during PHASE.Shifting so the overlay can announce it. */
  readonly nextMode: GameMode | null
  /** 0 for the first stage of a run, incremented on every shift. */
  readonly shiftIndex: number
  readonly secondsToShift: number
  /** True for the final seconds before a shift, so the HUD can flash. */
  readonly shiftWarning: boolean
  /** Frozen at game over, for the score-submit form. */
  readonly lastRunScore: number
  /** Human-readable notes on what the director changed, for the overlay. */
  readonly lastDirectorNotes: readonly string[]
  /**
   * The chaos flag governing the CURRENT stage, or null. Set at the start of
   * the transition that introduces it, so the glitch overlay announces it and
   * the HUD badge is already correct when play resumes. Without this the
   * player has no way to tell an intentional modifier from a bug.
   */
  readonly activeChaos: ChaosFlag | null
  /**
   * Which director produced the plan for the CURRENT stage. Rides the existing
   * per-shift patch rather than adding one, so it costs no extra re-render.
   * Surfaced in the HUD: it is how you tell a live-director run from a
   * heuristic one while tuning, and a small hook for the player besides.
   */
  readonly directorSource: PlanSource
  /** The once-daily cosmetic theme. It never drives gameplay math. */
  readonly memeTheme: MemeTheme
  /**
   * One line about the run just ended, written by the live director. Null
   * whenever there is no live director, it had nothing to say, or the answer
   * arrived too late to matter. Arrives a second or two AFTER the game-over
   * panel opens, which reads as the machine composing the burn.
   */
  readonly runEpitaph: string | null
}

export type GameCommand =
  | { readonly type: 'START_RUN' }
  | { readonly type: 'PAUSE' }
  | { readonly type: 'RESUME' }
  | { readonly type: 'QUIT_TO_MENU' }
  /** Dev/debug: collapse the shift countdown to zero immediately. */
  | { readonly type: 'FORCE_SHIFT' }
