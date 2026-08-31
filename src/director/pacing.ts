/**
 * Stage-length pacing, loaded from `public/config/pacing.json` so it can be
 * tuned without touching TypeScript or rebuilding.
 *
 * Values are in SECONDS in the file, because that is what you think in when
 * you are tuning a game, and milliseconds everywhere in the code.
 *
 * The file is hand-edited, which means it is untrusted input: `applyPacing`
 * validates and clamps every field and never throws. A malformed or missing
 * file leaves DEFAULT_PACING in place -- the game always starts.
 */

export interface PacingConfig {
  /** The opening stage, before the director has metrics to judge. */
  readonly firstStageMs: number
  /** What the director asks for on the first shift, before any taper. */
  readonly baseStageMs: number
  /** How much shorter each successive stage gets. */
  readonly taperPerShiftMs: number
  /** How many shifts the taper applies for before flattening out. */
  readonly taperShifts: number
  /** Hard floor enforced by clampModifiers, including on server overrides. */
  readonly minStageMs: number
  /** Hard ceiling enforced by clampModifiers. */
  readonly maxStageMs: number
}

// Mirrors public/config/pacing.json's committed values -- this is the
// fallback if that file is ever missing or fails to parse, so it needs to
// reflect the same intended pacing, not just be "some safe numbers".
export const DEFAULT_PACING: PacingConfig = {
  firstStageMs: 20_000,
  baseStageMs: 30_000,
  taperPerShiftMs: 2_000,
  taperShifts: 6,
  minStageMs: 18_000,
  maxStageMs: 30_000,
}

/** Outer sanity bounds. Nothing in the file can escape these. */
const ABSOLUTE_MIN_MS = 5_000
const ABSOLUTE_MAX_MS = 600_000

const SOURCE = '/config/pacing.json'

let current: PacingConfig = DEFAULT_PACING

export function getPacing(): PacingConfig {
  return current
}

function seconds(raw: unknown, fallbackMs: number): number {
  const n = typeof raw === 'number' ? raw * 1000 : Number.NaN
  return Number.isFinite(n) && n > 0 ? n : fallbackMs
}

/**
 * Validates a raw payload and installs it. Returns what was actually applied,
 * which may differ from what was asked for -- same philosophy as
 * clampModifiers: a bad value is corrected, never obeyed and never fatal.
 */
export function applyPacing(raw: unknown): PacingConfig {
  const o = (raw ?? {}) as Record<string, unknown>
  const d = DEFAULT_PACING

  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

  const minStageMs = clamp(
    seconds(o.minStageSeconds, d.minStageMs),
    ABSOLUTE_MIN_MS,
    ABSOLUTE_MAX_MS,
  )
  // The ceiling can never sit below the floor, whatever the file says.
  const maxStageMs = clamp(
    seconds(o.maxStageSeconds, d.maxStageMs),
    minStageMs,
    ABSOLUTE_MAX_MS,
  )

  current = {
    firstStageMs: clamp(seconds(o.firstStageSeconds, d.firstStageMs), minStageMs, maxStageMs),
    baseStageMs: clamp(seconds(o.baseStageSeconds, d.baseStageMs), minStageMs, maxStageMs),
    taperPerShiftMs: clamp(seconds(o.taperPerShiftSeconds, d.taperPerShiftMs), 0, 60_000),
    taperShifts: clamp(
      Number.isInteger(o.taperShifts) ? (o.taperShifts as number) : d.taperShifts,
      0,
      50,
    ),
    minStageMs,
    maxStageMs,
  }
  return current
}

export function resetPacing(): void {
  current = DEFAULT_PACING
}

/**
 * Fetches and applies the config. Safe to call repeatedly; a failure is not an
 * error condition, it just means the built-in defaults stand. Called once at
 * app start and again at the start of each run, so editing the JSON and
 * starting a new run is enough to see the change -- no rebuild, no reload.
 */
export async function loadPacing(): Promise<void> {
  try {
    const res = await fetch(SOURCE, { cache: 'no-store' })
    if (!res.ok) return
    applyPacing(await res.json())
  } catch {
    // No file served, or malformed JSON. Defaults stand.
  }
}
