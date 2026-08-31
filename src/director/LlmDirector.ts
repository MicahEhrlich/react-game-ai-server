import { HeuristicDirector } from './HeuristicDirector.ts'
import { applyLlmPlan, sanitiseLine } from './llmPlan.ts'
import { PLAN_SOURCE } from './types.ts'
import type {
  Director,
  DirectorHistory,
  LiveDirector,
  PlanSource,
  RunMetrics,
  RunSummary,
  StageBrief,
  StagePlan,
} from './types.ts'

/**
 * A Director that asks something slow for the next stage, and is completely
 * correct when it never answers.
 *
 * The shape is the one director/types.ts prescribes and stageOverrides.ts
 * already demonstrates: the slow call happens OFF the critical path, its
 * result lands in a cache, and the synchronous read either finds a valid
 * cached plan or falls through to the heuristic. `decide` never awaits, never
 * throws, and never blocks a shift.
 *
 * The timing is what makes it work. `prime` is called the instant a stage
 * starts and `decide` runs 3s before that stage ends, so a request has the
 * whole stage -- 30 to 90 seconds -- to complete. Missing that window costs
 * nothing but a heuristic stage.
 *
 * This file has no fetch, no DOM and no import.meta: the transport is
 * injected, which is what lets scripts/validate-llm-director.ts drive the
 * whole class with a fake and no API key, under a tsconfig with no DOM lib.
 *
 * NOTE: nothing here may import gameStore. Phaser->React is the orchestrator's
 * single channel (CLAUDE.md invariant 3); a director that patched the store
 * directly would be a third one.
 */

/** How long a stage plan may take before the heuristic simply wins. */
const PLAN_TIMEOUT_MS = 20_000
/** Shorter: the player is already looking at the game-over panel. */
const EPITAPH_TIMEOUT_MS = 12_000
/**
 * Hard ceiling on requests per run. A ~10-shift run needs about 11; a dev tab
 * left running on ?shift=5000 would otherwise issue one every five seconds
 * forever.
 */
const MAX_CALLS_PER_RUN = 14
/** Personas defined in the server's frozen system prompt. */
const PERSONA_COUNT = 4
const EPITAPH_MAX_LEN = 90

export interface PlanRequest {
  readonly kind: 'plan'
  readonly runId: string
  /** The shift index of the stage this plan is FOR. */
  readonly forShiftIndex: number
  readonly persona: number
  readonly metrics: RunMetrics
  readonly history: DirectorHistory
  readonly stages: readonly StageBrief[]
}

export interface EpitaphRequest {
  readonly kind: 'epitaph'
  readonly runId: string
  readonly persona: number
  readonly summary: RunSummary
}

export type DirectorRequest = PlanRequest | EpitaphRequest

/**
 * The one seam a validator fakes. Implementations resolve with whatever the
 * far end returned, parsed but NOT trusted -- llmPlan.ts does the trusting.
 * Rejection is a legal, expected outcome.
 */
export interface DirectorTransport {
  request(payload: DirectorRequest, signal: AbortSignal): Promise<unknown>
}

interface PlanSlot {
  readonly runId: string
  readonly forShiftIndex: number
  readonly plan: StagePlan
}

export class LlmDirector implements LiveDirector {
  // Explicit fields: `erasableSyntaxOnly` bans constructor parameter
  // properties, exactly as in HeuristicDirector.random.
  private readonly transport: DirectorTransport
  private readonly fallback: Director
  private readonly random: () => number
  private readonly log: (msg: string) => void

  // --- per-run state -----------------------------------------------------
  // beginRun() is this class's create(): the instance outlives every run, so
  // every field below MUST be reset there. Adding a field here and adding its
  // reset in beginRun() is one edit, never two (CLAUDE.md invariant 1).
  private runId = ''
  private slot: PlanSlot | null = null
  private inFlight: AbortController | null = null
  private epitaphInFlight: AbortController | null = null
  private persona = 0
  private calls = 0
  private source: PlanSource = PLAN_SOURCE.Heuristic

  constructor(
    transport: DirectorTransport,
    fallback: Director = new HeuristicDirector(),
    random: () => number = Math.random,
    log: (msg: string) => void = () => {},
  ) {
    this.transport = transport
    this.fallback = fallback
    this.random = random
    this.log = log
  }

  get lastSource(): PlanSource {
    return this.source
  }

  beginRun(runId: string): void {
    this.inFlight?.abort()
    this.epitaphInFlight?.abort()
    this.runId = runId
    this.slot = null
    this.inFlight = null
    this.epitaphInFlight = null
    this.persona = Math.floor(this.random() * PERSONA_COUNT) % PERSONA_COUNT
    this.calls = 0
    this.source = PLAN_SOURCE.Heuristic
  }

  /**
   * Ask for the stage after the one that just started. Fire-and-forget: the
   * caller must never await this, and every failure path is a silent no-op
   * that leaves the heuristic in charge.
   */
  prime(m: RunMetrics, h: DirectorHistory, stages: readonly StageBrief[]): void {
    if (!this.runId) return
    if (this.calls >= MAX_CALLS_PER_RUN) return

    const forShiftIndex = h.shiftIndex + 1

    // Cleared BEFORE anything async, so a slow or failed request can only ever
    // leave an EMPTY slot -- never the previous stage's plan, which would be
    // silently wrong rather than merely absent.
    this.slot = null
    this.inFlight?.abort()

    const runId = this.runId
    const controller = new AbortController()
    this.inFlight = controller
    const timer = setTimeout(() => controller.abort(), PLAN_TIMEOUT_MS)
    this.calls++

    // Computed now, while the metrics window is the one being described.
    const fallback = this.fallback.decide(m, h)
    this.log(`primed shift=${forShiftIndex}`)

    void (async () => {
      try {
        const raw = await this.transport.request(
          {
            kind: 'plan',
            runId,
            forShiftIndex,
            persona: this.persona,
            metrics: m,
            history: h,
            stages,
          },
          controller.signal,
        )
        // Both stamps are captured at issue time: a result that arrives after
        // a new run began, or after a newer request superseded this one, is
        // dropped rather than cached.
        if (this.runId !== runId) return
        if (this.inFlight !== controller) return

        const plan = applyLlmPlan(raw, fallback, h)
        if (plan.mode === h.currentMode) return // belt and braces
        this.slot = { runId, forShiftIndex, plan }
        this.log(`plan cached for shift=${forShiftIndex}`)
      } catch {
        // Timeout, abort, offline, no key, garbage JSON. All of these mean
        // "the heuristic decides", which is the normal path, not an error.
      } finally {
        clearTimeout(timer)
        if (this.inFlight === controller) this.inFlight = null
      }
    })()
  }

  /**
   * Synchronous and total. Reads the slot by identity rather than consuming
   * it, so the fallbackPlan() path in ShiftDirectorScene legitimately gets the
   * same plan a second time.
   */
  decide(m: RunMetrics, h: DirectorHistory): StagePlan {
    // Always computed: it is cheap, and it is the source of the notes and the
    // stage length that applyLlmPlan() merges over.
    const base = this.fallback.decide(m, h)
    const want = h.shiftIndex + 1
    const slot = this.slot

    if (
      slot &&
      slot.runId === this.runId &&
      slot.forShiftIndex === want &&
      slot.plan.mode !== h.currentMode
    ) {
      this.source = PLAN_SOURCE.Llm
      return slot.plan
    }

    this.log(`decide wants shift=${want} -- heuristic`)
    this.source = PLAN_SOURCE.Heuristic
    return base
  }

  /** Never rejects. Resolves null whenever there is nothing worth showing. */
  async epitaph(summary: RunSummary): Promise<string | null> {
    if (!this.runId || summary.runId !== this.runId) return null
    if (this.calls >= MAX_CALLS_PER_RUN) return null

    const runId = this.runId
    const controller = new AbortController()
    this.epitaphInFlight?.abort()
    this.epitaphInFlight = controller
    const timer = setTimeout(() => controller.abort(), EPITAPH_TIMEOUT_MS)
    this.calls++

    try {
      const raw = await this.transport.request(
        { kind: 'epitaph', runId, persona: this.persona, summary },
        controller.signal,
      )
      if (this.runId !== runId) return null
      if (typeof raw !== 'object' || raw === null) return null
      return sanitiseLine((raw as Record<string, unknown>).epitaph, EPITAPH_MAX_LEN)
    } catch {
      return null
    } finally {
      clearTimeout(timer)
      if (this.epitaphInFlight === controller) this.epitaphInFlight = null
    }
  }
}
