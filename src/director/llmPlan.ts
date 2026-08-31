import type { GameMode } from '../state/types.ts'
import { ALL_MODES, MODE_LABEL } from '../state/types.ts'
import { CHAOS_FLAGS, CHAOS_UNLOCK_SHIFT, clampModifiers } from './modifiers.ts'
import type { ChaosFlag } from './modifiers.ts'
import type { DirectorHistory, ModifierDraft, StagePlan } from './types.ts'

/**
 * Turns whatever a language model returned into a StagePlan that is safe to
 * play. Pure, synchronous, and it NEVER throws -- exactly the contract
 * applyPacing() holds for the hand-edited pacing JSON, for the same reason:
 * the input is untrusted, and the correct response to garbage is the fallback
 * plan, not an exception on the way into a stage.
 *
 * This file is the ONLY place three invariants are enforced at runtime:
 *
 *   1. the next mode is never the mode being played,
 *   2. a chaos flag never lands two stages running,
 *   3. a chaos flag never lands before CHAOS_UNLOCK_SHIFT.
 *
 * clampModifiers() does not cover any of them -- it bounds numbers and allows
 * at most one flag, but it has never seen `mode` and has no history. The
 * heuristic director gets them right by construction; a model does not.
 *
 * No DOM, no fetch, no import.meta: scripts/validate-llm-director.ts imports
 * this directly under tsconfig.node.json, which has no DOM lib.
 */

/** Longest note the glitch overlay renders without wrapping. */
export const NOTE_MAX_LEN = 42
/** Model-authored notes kept, before the NEXT: line is prepended. */
export const NOTE_MAX_COUNT = 3
/** Notes examined at all, before any per-item work. */
const NOTE_SCAN_LIMIT = 8
/** Shorter than this is noise, not a note. */
const NOTE_MIN_LEN = 4

/** A CSI escape must go before the control strip: removing the lone ESC
 *  first would leave a visible "[31m" behind. */
// eslint-disable-next-line no-control-regex -- matching them is the point
const ANSI_CSI = /\u001B\[[0-9;]*[A-Za-z]/g
/** C0 and C1 control ranges. This is what kills newlines and tabs. */
// eslint-disable-next-line no-control-regex -- matching them is the point
const CONTROLS = /[\u0000-\u001F\u007F-\u009F]/g
/** Markdown and HTML metacharacters. The overlay renders plain text nodes,
 *  so these can never execute -- they just look like a bug. */
const METACHARS = /[*_`~<>|#\\[\]{}]/g
const WHITESPACE_RUN = /\s+/g

function isGameMode(v: unknown): v is GameMode {
  return typeof v === 'string' && (ALL_MODES as readonly string[]).includes(v)
}

function isChaosFlag(v: unknown): v is ChaosFlag {
  return typeof v === 'string' && (CHAOS_FLAGS as readonly string[]).includes(v)
}

/**
 * One line of model prose, made safe to render. Returns null when nothing
 * meaningful survived.
 *
 * Deliberately does NOT change case. Uppercase is the game's voice and the
 * prompt's job; folding it here would mangle the house style's "x1.5" and
 * would still not match the heuristic's own notes on the fallback path.
 * This function's job is safety, not style.
 */
export function sanitiseLine(raw: unknown, maxLen: number): string | null {
  if (typeof raw !== 'string') return null
  const cleaned = truncate(
    raw
      .replace(ANSI_CSI, '')
      .replace(CONTROLS, ' ')
      .replace(METACHARS, '')
      .replace(WHITESPACE_RUN, ' ')
      .trim(),
    maxLen,
  )
  return cleaned.length >= NOTE_MIN_LEN ? cleaned : null
}

/**
 * Cuts at a word boundary where one is close enough to the limit. Only
 * over-long (i.e. off-schema) output ever reaches here, and a line severed
 * mid-word reads as a rendering bug rather than as a deliberately clipped
 * transmission.
 */
function truncate(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s
  const cut = s.slice(0, maxLen)
  const lastSpace = cut.lastIndexOf(' ')
  // Falling back to a hard cut when the last space is near the start, so a
  // single very long token cannot collapse the line to nothing.
  return (lastSpace >= Math.floor(maxLen * 0.6) ? cut.slice(0, lastSpace) : cut).trim()
}

/**
 * Bounds and cleans the model's note list, falling back whole when nothing
 * usable survives. The de-duplication is load-bearing: GlitchOverlay keys its
 * list items partly by note text, and two identical notes would collide.
 */
export function sanitiseNotes(raw: unknown, fallback: readonly string[]): readonly string[] {
  if (!Array.isArray(raw)) return fallback

  const seen = new Set<string>()
  const out: string[] = []

  // Bound the array BEFORE touching any element: a 40-item list of 500-char
  // strings should cost nothing, not forty sanitiser passes.
  for (const item of raw.slice(0, NOTE_SCAN_LIMIT)) {
    const line = sanitiseLine(item, NOTE_MAX_LEN)
    if (!line) continue
    const key = line.toUpperCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(line)
    if (out.length >= NOTE_MAX_COUNT) break
  }

  return out.length > 0 ? out : fallback
}

/** Drops any NEXT: line so the caller can prepend the authoritative one. */
function withoutNextLine(notes: readonly string[]): readonly string[] {
  return notes.filter((n) => !n.trimStart().toUpperCase().startsWith('NEXT:'))
}

/**
 * A model may only pick a number; it may not pick a nearby string. A "1.4"
 * means it went off-schema, and coercing rewards that -- pacing.ts sets the
 * same precedent for the hand-edited config.
 */
function num(raw: unknown, fallback: number): number {
  return typeof raw === 'number' ? raw : fallback
}

/**
 * Merges a model response over a known-good fallback plan.
 *
 * A malformed FIELD never rejects the whole plan. If the model picks an
 * illegal mode but writes three good taunts, the taunts are the part worth
 * having -- the mode quietly becomes the heuristic's. Only a response that is
 * not an object at all is discarded outright.
 */
export function applyLlmPlan(
  raw: unknown,
  fallback: StagePlan,
  history: DirectorHistory,
): StagePlan {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return fallback
  const r = raw as Record<string, unknown>

  // --- mode: real, and never the one being played right now ---------------
  const mode: GameMode =
    isGameMode(r.mode) && r.mode !== history.currentMode ? r.mode : fallback.mode

  // --- numbers ------------------------------------------------------------
  const base = fallback.modifiers
  const draft: ModifierDraft = {
    gravityScale: num(r.gravityScale, base.gravityScale),
    playerSpeedScale: num(r.playerSpeedScale, base.playerSpeedScale),
    spawnRateScale: num(r.spawnRateScale, base.spawnRateScale),
    projectileSpeedScale: num(r.projectileSpeedScale, base.projectileSpeedScale),
    scoreMultiplier: num(r.scoreMultiplier, base.scoreMultiplier),
    // Stage length is config, not a modifier the model gets a say in --
    // public/config/pacing.json owns it and is re-read every run.
    shiftDurationMs: base.shiftDurationMs,
  }

  // --- chaos: the two gates clampModifiers cannot see ----------------------
  // The threshold is read exactly as HeuristicDirector reads it -- against
  // history.shiftIndex, not the index of the stage being planned. The two
  // directors have to agree here or the same run would unlock chaos a stage
  // earlier depending on which one happened to answer.
  const chaosAllowed =
    !history.chaosLastStage && history.shiftIndex >= CHAOS_UNLOCK_SHIFT
  if (chaosAllowed && isChaosFlag(r.chaos)) draft[r.chaos] = true

  // --- notes --------------------------------------------------------------
  // NEXT: is prepended here rather than left to the model: it is the most
  // load-bearing line on the overlay, and it must agree with `mode` above
  // even when every other part of the response was discarded.
  const body = withoutNextLine(sanitiseNotes(r.notes, fallback.notes)).slice(0, NOTE_MAX_COUNT)
  const notes: readonly string[] = [`NEXT: ${MODE_LABEL[mode]}`, ...body]

  return { mode, modifiers: clampModifiers(draft), notes }
}
