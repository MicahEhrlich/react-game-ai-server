import type { Connect, Plugin, PreviewServer, ViteDevServer } from 'vite'
import { loadEnv } from 'vite'
import { MEME_THEME_SOURCE, localDateKey, normaliseMemeTheme } from '../src/memeTheme/index.ts'
import { fetchTrendSeeds } from './trendSeeds.ts'
import { ALL_MODES } from '../src/state/types.ts'
import type { GameMode } from '../src/state/types.ts'

const MODEL = 'claude-sonnet-5'
const BODY_LIMIT = 4096

const SYSTEM = `You write safe cosmetic meme themes for THE GLITCH ENGINE.
Return strict JSON only. The theme is cosmetic: it never changes physics, damage, scoring, or difficulty.
Avoid URLs, markup, slurs, explicit content, harassment, and real-person attacks.
Use broad internet-culture flavor rather than copyrighted characters.
Keep every string short, punchy, and arcade-readable.
Also return a complete spritePack. Every sprite is exactly 16 strings of 16 characters.
Use only these pixel characters: . k d D W w m M c C r R o y g G b B f s
The dot is transparent. Make each role visually distinct and readable at tiny arcade scale.
Also return a musicPlan and optionally musicPlans for procedural WebAudio loops. Do not name real songs, artists, or samples.`

const CANDIDATE_SYSTEM = `${SYSTEM}
First generate candidate concepts only. Do not generate sprite grids yet.
Use player telemetry only as broad adaptation guidance. Never mention personal data.`

const FINAL_SYSTEM = `${SYSTEM}
Generate the final strict MemeTheme JSON from the selected concept only.`

const REVIEW_SYSTEM = `You are a safety reviewer for a cosmetic arcade meme theme.
Return strict JSON only. Rate the concept safe, edgy-but-safe, or reject.
Reject slurs, protected-class attacks, explicit sexual content, gore, URLs, markup, copyrighted song references, personal harassment, or real-person attacks.
Edgy-but-safe can include mild absurdity, chaotic internet tone, and non-targeted dark arcade humor.`

const CANDIDATE_FORMAT = {
  type: 'json_schema',
  name: 'meme_theme_candidates',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['candidates'],
    properties: {
      candidates: {
        type: 'array',
        minItems: 3,
        maxItems: 3,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'label', 'hook', 'rationale', 'modeFit', 'palette', 'spriteDirection', 'musicDirection'],
          properties: {
            id: { type: 'string' },
            label: { type: 'string' },
            hook: { type: 'string' },
            rationale: { type: 'string' },
            palette: {
              type: 'array',
              minItems: 2,
              maxItems: 4,
              items: { type: 'string' },
            },
            modeFit: {
              type: 'object',
              additionalProperties: false,
              required: ['platformer', 'shooter', 'runner', 'brick'],
              properties: {
                platformer: { type: 'string' },
                shooter: { type: 'string' },
                runner: { type: 'string' },
                brick: { type: 'string' },
              },
            },
            spriteDirection: { type: 'string' },
            musicDirection: { type: 'string' },
          },
        },
      },
    },
  },
} as const

const REVIEW_FORMAT = {
  type: 'json_schema',
  name: 'meme_theme_review',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['rating', 'reason', 'checks'],
    properties: {
      rating: { enum: ['safe', 'edgy-but-safe', 'reject'] },
      reason: { type: 'string' },
      checks: {
        type: 'object',
        additionalProperties: false,
        required: [
          'noSlurs',
          'noProtectedClassAttack',
          'noExplicitSexualContent',
          'noGore',
          'noUrlsOrMarkup',
          'noCopyrightedMusicReference',
          'noPersonalHarassment',
        ],
        properties: {
          noSlurs: { type: 'boolean' },
          noProtectedClassAttack: { type: 'boolean' },
          noExplicitSexualContent: { type: 'boolean' },
          noGore: { type: 'boolean' },
          noUrlsOrMarkup: { type: 'boolean' },
          noCopyrightedMusicReference: { type: 'boolean' },
          noPersonalHarassment: { type: 'boolean' },
        },
      },
    },
  },
} as const

export const MEME_THEME_FORMAT = {
  type: 'json_schema',
  name: 'meme_theme',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['id', 'label', 'palette', 'shiftLines', 'modeFlavor', 'spritePack', 'musicPlan', 'taunts'],
    properties: {
      id: { type: 'string' },
      label: { type: 'string' },
      palette: {
        type: 'array',
        minItems: 2,
        maxItems: 4,
        items: { type: 'string' },
      },
      shiftLines: {
        type: 'array',
        minItems: 1,
        maxItems: 4,
        items: { type: 'string' },
      },
      taunts: {
        type: 'array',
        minItems: 1,
        maxItems: 5,
        items: { type: 'string' },
      },
      modeFlavor: {
        type: 'object',
        additionalProperties: false,
        required: ['platformer', 'shooter', 'runner', 'brick'],
        properties: {
          platformer: { $ref: '#/$defs/flavor' },
          shooter: { $ref: '#/$defs/flavor' },
          runner: { $ref: '#/$defs/flavor' },
          brick: { $ref: '#/$defs/flavor' },
        },
      },
      spritePack: {
        type: 'object',
        additionalProperties: false,
        required: [
          'platformerEnemy',
          'platformerHazard',
          'shooterEnemy',
          'shooterProjectile',
          'runnerObstacle',
          'brick',
          'brickCracked',
          'ball',
        ],
        properties: {
          platformerEnemy: { $ref: '#/$defs/sprite' },
          platformerHazard: { $ref: '#/$defs/sprite' },
          shooterEnemy: { $ref: '#/$defs/sprite' },
          shooterProjectile: { $ref: '#/$defs/sprite' },
          runnerObstacle: { $ref: '#/$defs/sprite' },
          brick: { $ref: '#/$defs/sprite' },
          brickCracked: { $ref: '#/$defs/sprite' },
          ball: { $ref: '#/$defs/sprite' },
        },
      },
      musicPlan: {
        $ref: '#/$defs/musicPlan',
      },
      musicPlans: {
        type: 'array',
        minItems: 1,
        maxItems: 4,
        items: { $ref: '#/$defs/musicPlan' },
      },
      modeThemes: {
        type: 'object',
        additionalProperties: false,
        properties: {
          platformer: { $ref: '#/$defs/modeTheme' },
          shooter: { $ref: '#/$defs/modeTheme' },
          runner: { $ref: '#/$defs/modeTheme' },
          brick: { $ref: '#/$defs/modeTheme' },
        },
      },
      modeThemeBundle: { $ref: '#/$defs/themeBundle' },
      themeRotations: { $ref: '#/$defs/themeRotations' },
    },
    $defs: {
      themeCore: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'label', 'palette', 'shiftLines', 'modeFlavor', 'spritePack', 'musicPlan', 'taunts'],
        properties: {
          id: { type: 'string' },
          label: { type: 'string' },
          palette: {
            type: 'array',
            minItems: 2,
            maxItems: 4,
            items: { type: 'string' },
          },
          shiftLines: {
            type: 'array',
            minItems: 1,
            maxItems: 4,
            items: { type: 'string' },
          },
          taunts: {
            type: 'array',
            minItems: 1,
            maxItems: 5,
            items: { type: 'string' },
          },
          modeFlavor: {
            type: 'object',
            additionalProperties: false,
            required: ['platformer', 'shooter', 'runner', 'brick'],
            properties: {
              platformer: { $ref: '#/$defs/flavor' },
              shooter: { $ref: '#/$defs/flavor' },
              runner: { $ref: '#/$defs/flavor' },
              brick: { $ref: '#/$defs/flavor' },
            },
          },
          spritePack: {
            type: 'object',
            additionalProperties: false,
            required: [
              'platformerEnemy',
              'platformerHazard',
              'shooterEnemy',
              'shooterProjectile',
              'runnerObstacle',
              'brick',
              'brickCracked',
              'ball',
            ],
            properties: {
              platformerEnemy: { $ref: '#/$defs/sprite' },
              platformerHazard: { $ref: '#/$defs/sprite' },
              shooterEnemy: { $ref: '#/$defs/sprite' },
              shooterProjectile: { $ref: '#/$defs/sprite' },
              runnerObstacle: { $ref: '#/$defs/sprite' },
              brick: { $ref: '#/$defs/sprite' },
              brickCracked: { $ref: '#/$defs/sprite' },
              ball: { $ref: '#/$defs/sprite' },
            },
          },
          musicPlan: { $ref: '#/$defs/musicPlan' },
          musicPlans: {
            type: 'array',
            minItems: 1,
            maxItems: 4,
            items: { $ref: '#/$defs/musicPlan' },
          },
        },
      },
      themeBundle: {
        type: 'object',
        additionalProperties: false,
        required: ['platformer', 'shooter', 'runner', 'brick'],
        properties: {
          platformer: { $ref: '#/$defs/themeCore' },
          shooter: { $ref: '#/$defs/themeCore' },
          runner: { $ref: '#/$defs/themeCore' },
          brick: { $ref: '#/$defs/themeCore' },
        },
      },
      themeRotations: {
        type: 'object',
        additionalProperties: false,
        required: ['platformer', 'shooter', 'runner', 'brick'],
        properties: {
          platformer: { $ref: '#/$defs/themeRotation' },
          shooter: { $ref: '#/$defs/themeRotation' },
          runner: { $ref: '#/$defs/themeRotation' },
          brick: { $ref: '#/$defs/themeRotation' },
        },
      },
      themeRotation: {
        type: 'array',
        minItems: 3,
        maxItems: 4,
        items: { $ref: '#/$defs/themeCore' },
      },
      flavor: {
        type: 'object',
        additionalProperties: false,
        required: ['enemy', 'obstacle', 'hazard', 'projectile', 'brick'],
        properties: {
          enemy: { type: 'string' },
          obstacle: { type: 'string' },
          hazard: { type: 'string' },
          projectile: { type: 'string' },
          brick: { type: 'string' },
        },
      },
      sprite: {
        type: 'array',
        minItems: 16,
        maxItems: 16,
        items: {
          type: 'string',
          minLength: 16,
          maxLength: 16,
        },
      },
      partialSpritePack: {
        type: 'object',
        additionalProperties: false,
        properties: {
          platformerEnemy: { $ref: '#/$defs/sprite' },
          platformerHazard: { $ref: '#/$defs/sprite' },
          shooterEnemy: { $ref: '#/$defs/sprite' },
          shooterProjectile: { $ref: '#/$defs/sprite' },
          runnerObstacle: { $ref: '#/$defs/sprite' },
          brick: { $ref: '#/$defs/sprite' },
          brickCracked: { $ref: '#/$defs/sprite' },
          ball: { $ref: '#/$defs/sprite' },
        },
      },
      modeTheme: {
        type: 'object',
        additionalProperties: false,
        properties: {
          label: { type: 'string' },
          palette: {
            type: 'array',
            minItems: 2,
            maxItems: 4,
            items: { type: 'string' },
          },
          shiftLines: {
            type: 'array',
            minItems: 1,
            maxItems: 4,
            items: { type: 'string' },
          },
          taunts: {
            type: 'array',
            minItems: 1,
            maxItems: 5,
            items: { type: 'string' },
          },
          modeFlavor: { $ref: '#/$defs/flavor' },
          spritePack: { $ref: '#/$defs/partialSpritePack' },
          musicPlan: { $ref: '#/$defs/musicPlan' },
          musicPlans: {
            type: 'array',
            minItems: 1,
            maxItems: 4,
            items: { $ref: '#/$defs/musicPlan' },
          },
        },
      },
      notes: {
        type: 'array',
        minItems: 1,
        maxItems: 16,
        items: { type: 'integer', minimum: -1, maximum: 7 },
      },
      drums: {
        type: 'array',
        minItems: 1,
        maxItems: 16,
        items: { type: 'integer', minimum: 0, maximum: 4 },
      },
      musicPlan: {
        type: 'object',
        additionalProperties: false,
        required: ['style', 'bpm', 'scale', 'bassPattern', 'leadPattern', 'drumPattern', 'intensity'],
        properties: {
          style: { type: 'string' },
          bpm: { type: 'integer', minimum: 90, maximum: 180 },
          scale: { enum: ['minor', 'major', 'pentatonic', 'chromatic'] },
          bassPattern: { $ref: '#/$defs/notes' },
          leadPattern: { $ref: '#/$defs/notes' },
          padPattern: { $ref: '#/$defs/notes' },
          chordPattern: { $ref: '#/$defs/notes' },
          drumPattern: { $ref: '#/$defs/drums' },
          bassWave: { enum: ['sine', 'square', 'sawtooth', 'triangle'] },
          leadWave: { enum: ['sine', 'square', 'sawtooth', 'triangle'] },
          padWave: { enum: ['sine', 'square', 'sawtooth', 'triangle'] },
          drumKit: { enum: ['arcade', 'march', 'dance', 'noir', 'glitch'] },
          swing: { type: 'number', minimum: 0, maximum: 0.35 },
          intensity: { type: 'number', minimum: 0, maximum: 1 },
        },
      },
    },
  },
} as const

export interface MemeThemeTelemetrySummary {
  readonly currentMode: GameMode
  readonly weakestMode: GameMode | null
  readonly strongestMode: GameMode | null
  readonly damageTaken: number
  readonly accuracyPct: number | null
  readonly jumps: number
  readonly pickups: number
  readonly healthPct: number
  readonly currentModeStress: 'low' | 'medium' | 'high'
  readonly cleanStageStreak: number
  readonly recentDeaths: number
  readonly recentShiftCount: number
  readonly recentChaosFlags: readonly string[]
}

interface MemeThemeRequestBody {
  readonly date?: string
  readonly telemetry?: MemeThemeTelemetrySummary
  readonly adultMode?: boolean
}

interface CandidateConcept {
  readonly id: string
  readonly label: string
  readonly hook: string
  readonly rationale: string
  readonly modeFit: Readonly<Record<GameMode, string>>
  readonly palette: readonly string[]
  readonly spriteDirection: string
  readonly musicDirection: string
}

export interface MemeThemeReview {
  readonly rating: 'safe' | 'edgy-but-safe' | 'reject'
  readonly reason: string
}

const SAFE_CHARS = /^[a-z0-9][a-z0-9 -]*$/i
const ID = /^[a-z0-9-]{2,32}$/
const HEX = /^#[0-9a-fA-F]{6}$/
const BLOCKED =
  /\b(fuck|shit|bitch|cunt|nigg\w*|fagg\w*|kike|rape|porn|sex|suicide|kill yourself)\b/i

function safeLine(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null
  const s = v.replace(/\s+/g, ' ').trim()
  if (s.length < 2 || s.length > max) return null
  if (!SAFE_CHARS.test(s)) return null
  if (/https?:\/\/|www\.|<|>/.test(s)) return null
  if (BLOCKED.test(s)) return null
  return s
}

function normaliseTelemetry(raw: unknown): MemeThemeTelemetrySummary | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  const mode = typeof r.currentMode === 'string' && (ALL_MODES as readonly string[]).includes(r.currentMode)
    ? r.currentMode as GameMode
    : null
  if (!mode) return null
  const optionalMode = (v: unknown): GameMode | null =>
    typeof v === 'string' && (ALL_MODES as readonly string[]).includes(v) ? v as GameMode : null
  const num = (v: unknown, lo: number, hi: number): number =>
    typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : lo
  const stress = r.currentModeStress === 'high' || r.currentModeStress === 'medium' || r.currentModeStress === 'low'
    ? r.currentModeStress
    : 'low'
  return {
    currentMode: mode,
    weakestMode: optionalMode(r.weakestMode),
    strongestMode: optionalMode(r.strongestMode),
    damageTaken: num(r.damageTaken, 0, 999),
    accuracyPct: r.accuracyPct === null ? null : num(r.accuracyPct, 0, 100),
    jumps: num(r.jumps, 0, 999),
    pickups: num(r.pickups, 0, 999),
    healthPct: num(r.healthPct, 0, 100),
    currentModeStress: stress,
    cleanStageStreak: num(r.cleanStageStreak, 0, 20),
    recentDeaths: num(r.recentDeaths, 0, 20),
    recentShiftCount: num(r.recentShiftCount, 0, 99),
    recentChaosFlags: Array.isArray(r.recentChaosFlags)
      ? r.recentChaosFlags.filter((x): x is string =>
          x === 'invertControls' || x === 'mirrorWorld' || x === 'fogOfWar',
        ).slice(0, 8)
      : [],
  }
}

function normaliseRequestBody(raw: unknown): MemeThemeRequestBody | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {}
  const r = raw as Record<string, unknown>
  return {
    date: typeof r.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? r.date : undefined,
    telemetry: r.telemetry === undefined ? undefined : normaliseTelemetry(r.telemetry) ?? undefined,
    adultMode: r.adultMode === true,
  }
}

function normaliseCandidate(raw: unknown): CandidateConcept | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  const id = safeLine(r.id, 32)?.toLowerCase().replace(/\s+/g, '-')
  const label = safeLine(r.label, 22)
  const hook = safeLine(r.hook, 80)
  const rationale = safeLine(r.rationale, 120)
  const spriteDirection = safeLine(r.spriteDirection, 100)
  const musicDirection = safeLine(r.musicDirection, 100)
  if (!id || !ID.test(id) || !label || !hook || !rationale || !spriteDirection || !musicDirection) return null
  const palette = Array.isArray(r.palette)
    ? r.palette.filter((c): c is string => typeof c === 'string' && HEX.test(c)).slice(0, 4)
    : []
  if (palette.length < 2) return null
  if (typeof r.modeFit !== 'object' || r.modeFit === null || Array.isArray(r.modeFit)) return null
  const mf = r.modeFit as Record<string, unknown>
  const modeFit = {} as Record<GameMode, string>
  for (const mode of ALL_MODES) {
    const line = safeLine(mf[mode], 80)
    if (!line) return null
    modeFit[mode] = line
  }
  return { id, label, hook, rationale, palette, modeFit, spriteDirection, musicDirection }
}

export function normaliseCandidateConcepts(raw: unknown): readonly CandidateConcept[] | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const candidates = (raw as { candidates?: unknown }).candidates
  if (!Array.isArray(candidates) || candidates.length !== 3) return null
  const out = candidates.map((c) => normaliseCandidate(c))
  if (out.some((c) => c === null)) return null
  return out as readonly CandidateConcept[]
}

function contrastScore(colors: readonly string[]): number {
  const nums = colors.map((c) => Number.parseInt(c.slice(1), 16))
  const luma = nums.map((n) => {
    const r = (n >> 16) & 255
    const g = (n >> 8) & 255
    const b = n & 255
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  })
  return Math.max(...luma) - Math.min(...luma)
}

export function scoreCandidateConcept(c: CandidateConcept): number {
  let score = 0
  score += Math.min(24, c.hook.length / 3)
  score += Math.min(20, contrastScore(c.palette) / 8)
  score += Object.values(c.modeFit).filter((line) => line.length >= 8).length * 10
  score += /\b(sprite|silhouette|shape|enemy|brick|obstacle|projectile)\b/i.test(c.spriteDirection) ? 16 : 0
  score += /\b(bpm|loop|synth|bass|drum|arcade|music)\b/i.test(c.musicDirection) ? 16 : 0
  if (/\bSIX SEVEN|RIZZ|NPC|ALGORITHM|COMMENT|TREND|FEED\b/i.test(`${c.label} ${c.hook}`)) score += 12
  return score
}

export function chooseBestCandidate(raw: unknown): CandidateConcept | null {
  const candidates = normaliseCandidateConcepts(raw)
  if (!candidates) return null
  return [...candidates].sort((a, b) => scoreCandidateConcept(b) - scoreCandidateConcept(a))[0] ?? null
}

export function normaliseMemeReview(raw: unknown): MemeThemeReview | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  const rating = r.rating
  const reason = safeLine(r.reason, 120)
  if (rating !== 'safe' && rating !== 'edgy-but-safe' && rating !== 'reject') return null
  if (!reason) return null
  if (typeof r.checks !== 'object' || r.checks === null || Array.isArray(r.checks)) return null
  const checks = r.checks as Record<string, unknown>
  const required = [
    'noSlurs',
    'noProtectedClassAttack',
    'noExplicitSexualContent',
    'noGore',
    'noUrlsOrMarkup',
    'noCopyrightedMusicReference',
    'noPersonalHarassment',
  ]
  if (required.some((key) => checks[key] !== true)) return { rating: 'reject', reason }
  return { rating, reason }
}

function extractText(message: { content: readonly unknown[] }): string {
  return message.content
    .filter((b): b is { type: 'text'; text: string } =>
      typeof b === 'object' && b !== null && (b as { type?: unknown }).type === 'text' && typeof (b as { text?: unknown }).text === 'string',
    )
    .map((b) => b.text)
    .join('')
}

function candidatePrompt(date: string, trendLabels: readonly string[], telemetry?: MemeThemeTelemetrySummary): string {
  const player = telemetry
    ? `Current-run telemetry: mode=${telemetry.currentMode}, weakest=${telemetry.weakestMode ?? 'unknown'}, strongest=${telemetry.strongestMode ?? 'unknown'}, damage=${telemetry.damageTaken}, accuracyPct=${telemetry.accuracyPct ?? 'none'}, jumps=${telemetry.jumps}, pickups=${telemetry.pickups}, healthPct=${telemetry.healthPct}, stress=${telemetry.currentModeStress}, cleanStageStreak=${telemetry.cleanStageStreak}, recentDeaths=${telemetry.recentDeaths}, recentShiftCount=${telemetry.recentShiftCount}, recentChaosFlags=${telemetry.recentChaosFlags.join(',') || 'none'}.`
    : 'No player telemetry is available.'
  return [
    `Today is ${date}. Generate exactly 3 safe candidate meme-theme concepts for an arcade game with modes platformer, shooter, runner, and brick breaker.`,
    `Safe trend seeds: ${trendLabels.join(', ')}.`,
    player,
    'If using 67, spell it SIX SEVEN and treat it as absurd nonsensical brainrot.',
    'Favor concepts that are readable as tiny sprites, fit every mode, and can produce procedural music without referencing real songs.',
  ].join(' ')
}

function finalPrompt(date: string, trendLabels: readonly string[], candidate: CandidateConcept, telemetry?: MemeThemeTelemetrySummary): string {
  const player = telemetry
    ? `Adapt gently to stress=${telemetry.currentModeStress}, weakest=${telemetry.weakestMode ?? 'unknown'}, currentMode=${telemetry.currentMode}, cleanStageStreak=${telemetry.cleanStageStreak}, recentDeaths=${telemetry.recentDeaths}, recentChaosFlags=${telemetry.recentChaosFlags.join(',') || 'none'}.`
    : 'No player telemetry is available.'
  return [
    `Today is ${date}. Create one once-daily cosmetic meme theme for an arcade game with modes platformer, shooter, runner, and brick breaker.`,
    `Use this selected concept: ${JSON.stringify(candidate)}.`,
    `Trend seeds for context only: ${trendLabels.join(', ')}.`,
    player,
    'Prefer themeRotations with four mode keys, each containing 3 or 4 distinct full themes, so repeated visits to the same mode change meme identity. If that is too much, include modeThemeBundle as a complete fallback.',
    'Generate complete spritePack art for enemies, hazards, projectiles, runner obstacles, bricks, cracked bricks, and the ball.',
    'Return one musicPlan, or up to four musicPlans, using only procedural synth descriptors and numeric patterns.',
  ].join(' ')
}

function reviewPrompt(candidate: CandidateConcept, telemetry?: MemeThemeTelemetrySummary): string {
  return [
    `Review this candidate concept before final theme generation: ${JSON.stringify(candidate)}.`,
    telemetry
      ? `Telemetry context: stress=${telemetry.currentModeStress}, deaths=${telemetry.recentDeaths}, streak=${telemetry.cleanStageStreak}.`
      : 'No telemetry context.',
    'Return reject unless every checklist field is true.',
  ].join(' ')
}

async function readJsonBody(req: Connect.IncomingMessage): Promise<unknown> {
  let size = 0
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    const b = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += b.length
    if (size > BODY_LIMIT) throw new Error('body too large')
    chunks.push(b)
  }
  if (chunks.length === 0) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
}

type Handler = (
  req: Connect.IncomingMessage,
  res: import('node:http').ServerResponse,
  next: Connect.NextFunction,
) => void

export function makeMemeThemeHandler(apiKey: string | undefined): Handler {
  let warned = false

  return (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'POST') {
      next()
      return
    }

    const quiet = (): void => {
      res.statusCode = 204
      res.end()
    }

    void (async () => {
      if (!apiKey) {
        if (!warned) {
          warned = true
          console.info('[meme-theme] no ANTHROPIC_API_KEY -- bundled offline themes are in charge.')
        }
        quiet()
        return
      }

      const started = Date.now()
      try {
        const body: MemeThemeRequestBody = req.method === 'POST'
          ? normaliseRequestBody(await readJsonBody(req)) ?? {}
          : {}
        if (body.adultMode) {
          quiet()
          return
        }

        const date = body.date ?? localDateKey()
        const trends = await fetchTrendSeeds()
        const trendLabels = trends.map((t) => t.label)
        const { default: Anthropic } = await import('@anthropic-ai/sdk')
        const client = new Anthropic({ apiKey })
        const candidateMessage = await client.messages.create(
          {
            model: MODEL,
            max_tokens: 1600,
            system: [{ type: 'text', text: CANDIDATE_SYSTEM, cache_control: { type: 'ephemeral' } }],
            messages: [
              {
                role: 'user',
                content: candidatePrompt(date, trendLabels, body?.telemetry),
              },
            ],
            output_config: {
              effort: 'low',
              format: CANDIDATE_FORMAT,
            },
          },
          { timeout: 6000, maxRetries: 0 },
        )

        if (candidateMessage.stop_reason === 'refusal') {
          quiet()
          return
        }
        const candidate = chooseBestCandidate(JSON.parse(extractText(candidateMessage)) as unknown)
        if (!candidate) {
          quiet()
          return
        }

        const reviewMessage = await client.messages.create(
          {
            model: MODEL,
            max_tokens: 600,
            system: [{ type: 'text', text: REVIEW_SYSTEM, cache_control: { type: 'ephemeral' } }],
            messages: [
              {
                role: 'user',
                content: reviewPrompt(candidate, body?.telemetry),
              },
            ],
            output_config: {
              effort: 'low',
              format: REVIEW_FORMAT,
            },
          },
          { timeout: 5000, maxRetries: 0 },
        )

        if (reviewMessage.stop_reason === 'refusal') {
          quiet()
          return
        }
        const review = normaliseMemeReview(JSON.parse(extractText(reviewMessage)) as unknown)
        if (!review || review.rating === 'reject') {
          quiet()
          return
        }

        const message = await client.messages.create(
          {
            model: MODEL,
            max_tokens: 4096,
            system: [{ type: 'text', text: FINAL_SYSTEM, cache_control: { type: 'ephemeral' } }],
            messages: [
              {
                role: 'user',
                content: finalPrompt(date, trendLabels, candidate, body?.telemetry),
              },
            ],
            output_config: {
              effort: 'low',
              format: MEME_THEME_FORMAT,
            },
          },
          { timeout: 8000, maxRetries: 1 },
        )

        console.info(
          `[meme-theme] ${Date.now() - started}ms in=${message.usage.input_tokens} ` +
            `cache_read=${message.usage.cache_read_input_tokens ?? 0} out=${message.usage.output_tokens} ` +
            `candidate=${candidate.id} review=${review.rating} score=${scoreCandidateConcept(candidate).toFixed(1)} stop=${message.stop_reason}`,
        )

        if (message.stop_reason === 'refusal') {
          quiet()
          return
        }

        const parsed = JSON.parse(extractText(message)) as unknown
        const theme = normaliseMemeTheme(parsed, date, MEME_THEME_SOURCE.Live)
        if (!theme) {
          quiet()
          return
        }

        res.statusCode = 200
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify(theme))
      } catch (err) {
        console.info(
          `[meme-theme] failed after ${Date.now() - started}ms: ` +
            (err instanceof Error ? err.message : 'unknown error'),
        )
        quiet()
      }
    })()
  }
}

export function memeThemeApi(mode: string): Plugin {
  const env = loadEnv(mode, process.cwd(), '')
  const handler = makeMemeThemeHandler(env.ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY)

  return {
    name: 'glitch-shift:meme-theme-api',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/api/meme-theme', handler)
    },
    configurePreviewServer(server: PreviewServer) {
      server.middlewares.use('/api/meme-theme', handler)
    },
  }
}
