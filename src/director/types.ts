import type { GameMode } from '../state/types.ts'

/**
 * Mode-agnostic difficulty vocabulary. The director emits these without
 * knowing which mode comes next; each scene's setupMode() maps them onto its
 * own numbers (see modifiers.ts for the ranges clampModifiers enforces).
 */
export interface StageModifiers {
  /** Platformer/runner gravity; the shooter reads it as vertical drift. */
  readonly gravityScale: number
  readonly playerSpeedScale: number
  /** Hazard density | enemy wave rate | obstacle rate, per mode. */
  readonly spawnRateScale: number
  readonly projectileSpeedScale: number
  readonly scoreMultiplier: number
  // --- chaos flags: at most one active at a time (see HeuristicDirector) ---
  readonly invertControls: boolean
  readonly mirrorWorld: boolean
  readonly fogOfWar: boolean
  // --- pacing ---
  readonly shiftDurationMs: number
}

/**
 * A mutable, partial StageModifiers, for code that BUILDS a set of modifiers
 * (the director, the dev overrides). StageModifiers itself is readonly so
 * that a scene can never mutate the stage it is running under.
 */
export type ModifierDraft = { -readonly [K in keyof StageModifiers]?: StageModifiers[K] }

/** A snapshot of how the player did, covering one shift window. */
export interface RunMetrics {
  readonly mode: GameMode
  readonly windowMs: number
  readonly shotsFired: number
  readonly shotsHit: number
  readonly damageTaken: number
  readonly pickups: number
  readonly jumps: number
  /** Mean ms between a threat appearing and the player reacting; 0 if unsampled. */
  readonly avgReactionMs: number
  /** Health as a 0..1 fraction at the moment of the snapshot. */
  readonly healthFraction: number
  /** Cumulative ms played in each mode across the whole run. */
  readonly msPerMode: Readonly<Record<GameMode, number>>
}

/** What the director decides for the upcoming stage. */
export interface StagePlan {
  readonly mode: GameMode
  readonly modifiers: StageModifiers
  /** Short human-readable reasons, surfaced on the glitch overlay. */
  readonly notes: readonly string[]
}

/**
 * The seam a future LLM-backed director implements. `decide` is synchronous
 * by design: it is called 3s ahead of the shift, and a stage plan must always
 * be available on time. An async implementation belongs behind a cache that
 * falls back to the heuristic, not behind a change to this signature.
 */
export interface Director {
  decide(metrics: RunMetrics, history: DirectorHistory): StagePlan
}

/** What the director is allowed to know about earlier stages. */
export interface DirectorHistory {
  readonly shiftIndex: number
  readonly currentMode: GameMode
  /** Modes played so far, oldest first. */
  readonly modeHistory: readonly GameMode[]
  /** True if the previous stage already had a chaos flag on. */
  readonly chaosLastStage: boolean
}

/** Which director actually produced the plan the player is about to play. */
export const PLAN_SOURCE = {
  Heuristic: 'heuristic',
  Llm: 'llm',
} as const
export type PlanSource = (typeof PLAN_SOURCE)[keyof typeof PLAN_SOURCE]

/** One finished stage, flattened for a director's run narrative. */
export interface StageBrief {
  readonly shiftIndex: number
  readonly mode: GameMode
  readonly seconds: number
  readonly scoreAtEnd: number
  readonly healthPct: number
  readonly damageTaken: number
  /** null when the mode fired no shots, so "0%" is never claimed falsely. */
  readonly accuracyPct: number | null
  readonly notes: readonly string[]
}

/** The whole run, handed over once at game over. */
export interface RunSummary {
  readonly runId: string
  readonly finalScore: number
  readonly shifts: number
  readonly finalMode: GameMode
  readonly stages: readonly StageBrief[]
}

/**
 * A Director that can also talk to something slow.
 *
 * Everything added here is OPTIONAL BEHAVIOUR, not an extension of the
 * contract above: `decide` is still the only thing the game requires, still
 * synchronous, and still guaranteed to return. These members exist so the
 * orchestrator can hand a live director time (`prime`, called a whole stage
 * ahead) and run boundaries (`beginRun`), neither of which `decide` can
 * express. A director that implements them must still be fully correct when
 * every one of them fails.
 */
export interface LiveDirector extends Director {
  /** Called at START_RUN. Must drop every scrap of the previous run. */
  beginRun(runId: string): void
  /**
   * Called just after a stage swap commits. Fire-and-forget; never awaited.
   *
   * `stages` is the run so far, oldest first. It is passed in rather than
   * read, because a director must not depend on the telemetry module: that
   * module reaches localStorage, and the validate-* scripts run under a
   * tsconfig with no DOM lib.
   */
  prime(
    metrics: RunMetrics,
    history: DirectorHistory,
    stages: readonly StageBrief[],
  ): void
  /** Never rejects. Resolves null when there is nothing to say. */
  epitaph(summary: RunSummary): Promise<string | null>
  /** How the most recent decide() was served. */
  readonly lastSource: PlanSource
}

export function isLiveDirector(d: Director): d is LiveDirector {
  return typeof (d as Partial<LiveDirector>).prime === 'function'
}
