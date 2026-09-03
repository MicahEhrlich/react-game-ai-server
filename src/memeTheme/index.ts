import { ALL_MODES, MODE } from '../state/types.ts'
import type { GameMode } from '../state/types.ts'
import { PALETTE } from '../game/art/palette.ts'

/** One row per string; one char per pixel; '.' is transparent. */
export type PixelSprite = readonly string[]

export const MEME_THEME_SOURCE = {
  Offline: 'offline',
  Live: 'live',
} as const
export type MemeThemeSource = (typeof MEME_THEME_SOURCE)[keyof typeof MEME_THEME_SOURCE]

export interface MemeModeFlavor {
  readonly enemy: string
  readonly obstacle: string
  readonly hazard: string
  readonly projectile: string
  readonly brick: string
}

export interface MemeTheme {
  readonly id: string
  readonly variantId?: string
  readonly bundleThemes?: Readonly<Record<GameMode, MemeTheme>>
  readonly themeRotations?: Readonly<Record<GameMode, readonly MemeTheme[]>>
  readonly label: string
  readonly source: MemeThemeSource
  readonly date: string
  readonly palette: readonly string[]
  readonly shiftLines: readonly string[]
  readonly modeFlavor: Readonly<Record<GameMode, MemeModeFlavor>>
  readonly spritePack?: MemeSpritePack
  readonly musicPlan: MemeMusicPlan
  readonly musicPlans?: readonly MemeMusicPlan[]
  readonly taunts: readonly string[]
  readonly modeThemes?: Partial<Record<GameMode, MemeModeTheme>>
}

export interface MemeModeTheme {
  readonly label?: string
  readonly palette?: readonly string[]
  readonly shiftLines?: readonly string[]
  readonly modeFlavor?: MemeModeFlavor
  readonly spritePack?: Partial<Record<MemeSpriteRole, PixelSprite>>
  readonly musicPlan?: MemeMusicPlan
  readonly musicPlans?: readonly MemeMusicPlan[]
  readonly taunts?: readonly string[]
}

export type MemeThemeDraft = Partial<Omit<MemeTheme, 'source'>> & {
  readonly source?: unknown
  readonly modeFlavor?: unknown
}

const MAX_ID = 32
const MAX_LABEL = 22
const MAX_LINE = 54
const MAX_FLAVOR = 18
const MAX_TAUNT = 64
const SPRITE_SIZE = 16
const MAX_PATTERN = 16
const MAX_MUSIC_PLANS = 4
const HEX = /^#[0-9a-fA-F]{6}$/
const DATE = /^\d{4}-\d{2}-\d{2}$/
const URL_OR_MARKUP = /(https?:\/\/|www\.|<[^>]+>|[{}[\]\\])/i
const BLOCKED = /\b(fuck|shit|bitch|cunt|nigg\w*|fagg\w*|kike|rape|porn|sex|kill yourself|suicide)\b/i

export const MEME_SPRITE_ROLE = {
  PlatformerEnemy: 'platformerEnemy',
  PlatformerHazard: 'platformerHazard',
  ShooterEnemy: 'shooterEnemy',
  ShooterProjectile: 'shooterProjectile',
  RunnerObstacle: 'runnerObstacle',
  Brick: 'brick',
  BrickCracked: 'brickCracked',
  Ball: 'ball',
} as const
export type MemeSpriteRole = (typeof MEME_SPRITE_ROLE)[keyof typeof MEME_SPRITE_ROLE]
export const ALL_MEME_SPRITE_ROLES: readonly MemeSpriteRole[] = Object.values(MEME_SPRITE_ROLE)
export type MemeSpritePack = Readonly<Record<MemeSpriteRole, PixelSprite>>

export const MUSIC_SCALE = {
  Minor: 'minor',
  Major: 'major',
  Pentatonic: 'pentatonic',
  Chromatic: 'chromatic',
} as const
export type MusicScale = (typeof MUSIC_SCALE)[keyof typeof MUSIC_SCALE]
export type MusicWave = 'sine' | 'square' | 'sawtooth' | 'triangle'

export interface MemeMusicPlan {
  readonly style: string
  readonly bpm: number
  readonly scale: MusicScale
  /** Scale degrees, 0..7, or -1 for a rest. */
  readonly bassPattern: readonly number[]
  readonly leadPattern: readonly number[]
  readonly padPattern?: readonly number[]
  readonly chordPattern?: readonly number[]
  /** 0 rest, 1 kick, 2 snare, 3 hat, 4 noise hit. */
  readonly drumPattern: readonly number[]
  readonly bassWave?: MusicWave
  readonly leadWave?: MusicWave
  readonly padWave?: MusicWave
  readonly drumKit?: 'arcade' | 'march' | 'dance' | 'noir' | 'glitch'
  readonly swing?: number
  readonly intensity: number
}

const PIXEL_CHARS = new Set(['.', ...Object.keys(PALETTE)])
const SCALES = new Set<string>(Object.values(MUSIC_SCALE))
const OSC_WAVES = new Set<MusicWave>(['sine', 'square', 'sawtooth', 'triangle'])
const DRUM_KITS = new Set(['arcade', 'march', 'dance', 'noir', 'glitch'])

const MUSIC = {
  Office: {
    style: 'syncopated office panic',
    bpm: 134,
    scale: MUSIC_SCALE.Minor,
    bassPattern: [0, -1, 0, 3, 0, -1, 5, 3],
    leadPattern: [7, 6, -1, 5, 3, -1, 2, 3, 5, -1, 6, 5, 3, 2, -1, 0],
    chordPattern: [0, -1, 3, -1, 5, -1, 3, -1],
    drumPattern: [1, 3, 2, 3, 1, 3, 2, 4, 1, 3, 2, 3, 1, 3, 2, 3],
    bassWave: 'triangle',
    leadWave: 'square',
    padWave: 'sine',
    drumKit: 'glitch',
    swing: 0.08,
    intensity: 0.62,
  },
  Comment: {
    style: 'argument arcade',
    bpm: 152,
    scale: MUSIC_SCALE.Chromatic,
    bassPattern: [0, 1, -1, 0, 3, -1, 2, 1],
    leadPattern: [5, 6, 5, -1, 3, 2, 3, -1, 6, 7, 6, 5, -1, 3, 2, 1],
    drumPattern: [1, 3, 2, 3, 1, 4, 2, 3, 1, 3, 2, 3, 1, 3, 2, 4],
    bassWave: 'sawtooth',
    leadWave: 'sawtooth',
    drumKit: 'glitch',
    intensity: 0.74,
  },
  Algo: {
    style: 'feed scroll trance',
    bpm: 128,
    scale: MUSIC_SCALE.Pentatonic,
    bassPattern: [0, -1, 2, -1, 3, -1, 2, -1],
    leadPattern: [0, 2, 3, 5, -1, 7, 5, 3, 2, -1, 3, 5, 7, 5, 3, 2],
    padPattern: [0, -1, -1, -1, 3, -1, -1, -1],
    drumPattern: [1, 3, 3, 2, 1, 3, 3, 2, 1, 3, 4, 2, 1, 3, 3, 2],
    bassWave: 'sine',
    leadWave: 'triangle',
    padWave: 'sine',
    drumKit: 'dance',
    intensity: 0.58,
  },
  SixSeven: {
    style: 'six seven bounce',
    bpm: 167,
    scale: MUSIC_SCALE.Pentatonic,
    bassPattern: [6, -1, 7, -1, 6, 7, -1, 3],
    leadPattern: [6, 7, -1, 6, 7, 5, -1, 3, 6, 7, -1, 7, 6, 3, -1, 0],
    drumPattern: [1, 3, 2, 3, 1, 4, 2, 3, 1, 3, 2, 3, 1, 3, 2, 4],
    bassWave: 'square',
    leadWave: 'square',
    drumKit: 'arcade',
    intensity: 0.78,
  },
  Rizz: {
    style: 'smooth neon flex',
    bpm: 116,
    scale: MUSIC_SCALE.Minor,
    bassPattern: [0, -1, 3, -1, 5, -1, 3, -1],
    leadPattern: [7, -1, 6, 5, -1, 3, 5, 6, 7, -1, 5, 3, -1, 2, 3, 5],
    chordPattern: [0, -1, -1, -1, 3, -1, 5, -1],
    drumPattern: [1, 3, 3, 2, 1, 3, 3, 2, 1, 3, 4, 2, 1, 3, 3, 2],
    bassWave: 'sine',
    leadWave: 'triangle',
    padWave: 'triangle',
    drumKit: 'dance',
    swing: 0.18,
    intensity: 0.52,
  },
  Npc: {
    style: 'looping npc chant',
    bpm: 140,
    scale: MUSIC_SCALE.Minor,
    bassPattern: [0, 0, -1, 0, 2, 2, -1, 2],
    leadPattern: [3, -1, 3, -1, 2, -1, 2, -1, 5, -1, 5, -1, 3, 2, -1, 0],
    drumPattern: [1, 3, 2, 3, 1, 3, 2, 3, 1, 3, 2, 4, 1, 3, 2, 3],
    bassWave: 'square',
    leadWave: 'sine',
    drumKit: 'arcade',
    intensity: 0.64,
  },
  RallyStomp: {
    style: 'rally stomp',
    bpm: 126,
    scale: MUSIC_SCALE.Major,
    bassPattern: [0, -1, 0, 4, 5, -1, 4, 2],
    leadPattern: [7, -1, 5, 4, 2, -1, 4, 5, 7, -1, 7, 5, 4, 2, -1, 0],
    drumPattern: [1, 3, 2, 3, 1, 4, 2, 3, 1, 3, 2, 3, 1, 4, 2, 3],
    bassWave: 'sawtooth',
    leadWave: 'square',
    drumKit: 'march',
    intensity: 0.72,
  },
  IslandNoir: {
    style: 'island noir',
    bpm: 104,
    scale: MUSIC_SCALE.Minor,
    bassPattern: [0, -1, 3, -1, 2, -1, 5, -1],
    leadPattern: [7, -1, 6, -1, 3, 2, -1, 0, 5, -1, 3, -1, 2, -1, 0, -1],
    chordPattern: [0, -1, -1, -1, 5, -1, -1, -1],
    drumPattern: [1, 3, 3, 2, 0, 3, 4, 3, 1, 3, 3, 2, 0, 3, 3, 4],
    bassWave: 'sine',
    leadWave: 'triangle',
    padWave: 'sine',
    drumKit: 'noir',
    swing: 0.14,
    intensity: 0.46,
  },
  BorderWallBounce: {
    style: 'border wall bounce',
    bpm: 148,
    scale: MUSIC_SCALE.Pentatonic,
    bassPattern: [0, 0, -1, 3, 5, -1, 3, -1],
    leadPattern: [0, 3, 5, 7, -1, 5, 3, -1, 0, 3, 5, 7, 5, 3, -1, 0],
    drumPattern: [1, 3, 2, 4, 1, 3, 2, 3, 1, 4, 2, 3, 1, 3, 2, 4],
    bassWave: 'square',
    leadWave: 'sawtooth',
    drumKit: 'march',
    intensity: 0.76,
  },
  DebateClub: {
    style: 'debate club',
    bpm: 138,
    scale: MUSIC_SCALE.Chromatic,
    bassPattern: [0, 1, 0, -1, 3, 2, 1, -1],
    leadPattern: [4, 5, -1, 4, 2, 3, -1, 2, 6, 7, 6, -1, 4, 3, 2, -1],
    drumPattern: [1, 3, 2, 3, 1, 4, 2, 4, 1, 3, 2, 3, 1, 3, 2, 4],
    bassWave: 'sawtooth',
    leadWave: 'sawtooth',
    drumKit: 'glitch',
    swing: 0.06,
    intensity: 0.66,
  },
  WarRoomPulse: {
    style: 'war room pulse',
    bpm: 160,
    scale: MUSIC_SCALE.Minor,
    bassPattern: [0, -1, 0, -1, 5, -1, 3, -1],
    leadPattern: [0, -1, 2, -1, 3, 5, -1, 3, 7, -1, 6, 5, 3, -1, 2, 0],
    drumPattern: [1, 3, 2, 3, 1, 3, 4, 3, 1, 3, 2, 3, 1, 4, 2, 3],
    bassWave: 'sawtooth',
    leadWave: 'triangle',
    drumKit: 'march',
    intensity: 0.7,
  },
  ArcadeLounge: {
    style: 'arcade lounge',
    bpm: 112,
    scale: MUSIC_SCALE.Major,
    bassPattern: [0, -1, 4, -1, 5, -1, 4, -1],
    leadPattern: [0, 2, 4, -1, 5, 7, -1, 5, 4, 2, -1, 0, 2, 4, 5, -1],
    padPattern: [0, -1, -1, -1, 4, -1, -1, -1],
    drumPattern: [1, 3, 3, 2, 0, 3, 3, 2, 1, 3, 4, 2, 0, 3, 3, 2],
    bassWave: 'sine',
    leadWave: 'triangle',
    padWave: 'sine',
    drumKit: 'noir',
    swing: 0.22,
    intensity: 0.42,
  },
  KirkMarch: {
    style: 'anthem lament',
    bpm: 90,
    scale: MUSIC_SCALE.Minor,
    bassPattern: [0, -1, 3, -1, 6, -1, 2, -1, 4, -1, 0, -1, 5, -1, 4, 0],
    leadPattern: [4, -1, 4, 5, 3, -1, 2, 1, 0, -1, 2, 3, 5, -1, 4, 2],
    padPattern: [0, -1, -1, -1, 3, -1, -1, -1, 6, -1, -1, -1, 2, -1, 4, -1],
    chordPattern: [0, -1, 3, -1, 6, -1, 2, -1, 4, -1, 0, -1, 5, -1, 4, 0],
    drumPattern: [1, 0, 3, 0, 2, 0, 3, 0, 1, 0, 3, 0, 2, 0, 4, 0],
    bassWave: 'triangle',
    leadWave: 'square',
    padWave: 'triangle',
    drumKit: 'march',
    intensity: 0.92,
  },
  KirkInterlude: {
    style: 'anthem rise',
    bpm: 90,
    scale: MUSIC_SCALE.Minor,
    bassPattern: [0, -1, 4, -1, 5, -1, 4, -1, 0, -1, 6, -1, 3, -1, 4, -1],
    leadPattern: [0, 2, 3, -1, 5, 6, 5, -1, 7, 6, 5, 3, 5, -1, 4, 2],
    padPattern: [0, -1, -1, -1, 4, -1, -1, -1, 5, -1, -1, -1, 3, -1, 4, -1],
    chordPattern: [0, -1, 4, -1, 5, -1, 4, -1, 0, -1, 6, -1, 3, -1, 4, -1],
    drumPattern: [1, 0, 3, 3, 2, 0, 3, 0, 1, 0, 3, 3, 2, 0, 4, 0],
    bassWave: 'triangle',
    leadWave: 'square',
    padWave: 'triangle',
    drumKit: 'march',
    intensity: 0.94,
  },
  KirkBridge: {
    style: 'anthem bridge',
    bpm: 90,
    scale: MUSIC_SCALE.Minor,
    bassPattern: [3, -1, 0, -1, 3, -1, 0, -1, 3, -1, 0, -1, 5, -1, 4, 4],
    leadPattern: [3, -1, 5, 7, 5, -1, 3, 2, 3, -1, 5, 7, 6, -1, 5, 4],
    padPattern: [3, -1, -1, -1, 0, -1, -1, -1, 3, -1, -1, -1, 5, -1, 4, -1],
    chordPattern: [3, -1, 0, -1, 3, -1, 0, -1, 3, -1, 0, -1, 5, -1, 4, -1],
    drumPattern: [1, 0, 2, 3, 1, 0, 3, 0, 1, 0, 2, 3, 1, 0, 4, 0],
    bassWave: 'triangle',
    leadWave: 'square',
    padWave: 'triangle',
    drumKit: 'march',
    intensity: 0.96,
  },
} satisfies Record<string, MemeMusicPlan>

const DEFAULT_FLAVOR: MemeModeFlavor = {
  enemy: 'DRAMA BOT',
  obstacle: 'BAD TAKE',
  hazard: 'HOT TAKE',
  projectile: 'REPLY',
  brick: 'THREAD',
}

const OFFICE_SPRITES: MemeSpritePack = {
  platformerEnemy: [
    '................',
    '....DWWWWWWD....',
    '...DWwwwwwwWD...',
    '...DwkwwkwkWD...',
    '...DWwwwwwwWD...',
    '....DMMMMMD.....',
    '....DyyyyyD.....',
    '...DDDDDDDDD....',
    '..DdcccccddD....',
    '..DdcccccddD....',
    '...DDDDDDDDD....',
    '....D..D..D.....',
    '....D..D..D.....',
    '...MM..M..MM....',
    '................',
    '................',
  ],
  platformerHazard: [
    '................',
    '.......yy.......',
    '......yyyy......',
    '.....yoooyo.....',
    '....yoooooy.....',
    '...yoorrrrooy...',
    '..yooorrrroooy..',
    '.yooorMMMMroooy.',
    '.yyyyyMMMMyyyyy.',
    '....DMMMMMMD....',
    '....DcccccD.....',
    '....DcccccD.....',
    '....DDDDDDD.....',
    '................',
    '................',
    '................',
  ],
  shooterEnemy: [
    '................',
    '......DDDD......',
    '....DDWWWWDD....',
    '...DWccccccWD...',
    '..DWcDccccDcWD..',
    '.DWccccccccccWD.',
    '.DWWWWWWWWWWWWD.',
    '..DMMMcMMcMMMD..',
    '...DMMcMMcMMD...',
    '....DDDDDDDD....',
    '.....c....c.....',
    '....ccc..ccc....',
    '................',
    '................',
    '................',
    '................',
  ],
  shooterProjectile: [
    '................',
    '................',
    '................',
    '................',
    '..yyyyyyyyyy....',
    '.ywwwwwwwwwwy...',
    '..yyyyyyyyyy....',
    '.....cc.........',
    '.....cc.........',
    '..yyyyyyyyyy....',
    '.ywwwwwwwwwwy...',
    '..yyyyyyyyyy....',
    '................',
    '................',
    '................',
    '................',
  ],
  runnerObstacle: [
    '................',
    '..DDDDDDDDDDDD..',
    '.DyyyyyyyyyyyyD.',
    '.DyDDyDDyDDyDDD.',
    '.DyyyyyyyyyyyyD.',
    '.DccccccccccccD.',
    '.DccccccccccccD.',
    '.DDDDDDDDDDDDDD.',
    '.DWWWWWWWWWWWWD.',
    '.DWWDWWWDWWWWDD.',
    '.DWWWWWWWWWWWWD.',
    '.DDDDDDDDDDDDDD.',
    '................',
    '................',
    '................',
    '................',
  ],
  brick: [
    'cccccccccccccccc',
    'cWWWWWWWWWWWWWWC',
    'cWyyyyyyyyyyyyWC',
    'cWyyyyyyyyyyyyWC',
    'cWyyyyyyyyyyyyWC',
    'cWWWWWWWWWWWWWWC',
    'cMMMMMMMMMMMMMMC',
    'cMDDDDDDDDDDDDMC',
    'cMDDDDDDDDDDDDMC',
    'cMDDDDDDDDDDDDMC',
    'cMMMMMMMMMMMMMMC',
    'cWWWWWWWWWWWWWWC',
    'cWccccccccccccWC',
    'cWccccccccccccWC',
    'cWWWWWWWWWWWWWWC',
    'CCCCCCCCCCCCCCCC',
  ],
  brickCracked: [
    'cccccccccccccccc',
    'cWWWWWWWWWWWWWWC',
    'cWyyykkkyyyyyyWC',
    'cWyyyykkkyyyyyWC',
    'cWyyyyykkkyyyyWC',
    'cWWWWWWkWWWWWWWC',
    'cMMMMMMkMMMMMMMC',
    'cMDDDDkDDDDDDDMC',
    'cMDDDkDDDDDDDDMC',
    'cMDDkDDDDDDDDDMC',
    'cMMkMMMMMMMMMMMC',
    'cWWkWWWWWWWWWWWC',
    'cWccccckccccccWC',
    'cWcccccckcccccWC',
    'cWWWWWWWWkWWWWWC',
    'CCCCCCCCCCCCCCCC',
  ],
  ball: [
    '................',
    '................',
    '................',
    '................',
    '......yyyy......',
    '.....ywwwwy.....',
    '....ywwccwwy....',
    '....ywccccwy....',
    '....ywccccwy....',
    '....ywwccwwy....',
    '.....ywwwwy.....',
    '......yyyy......',
    '................',
    '................',
    '................',
    '................',
  ],
}

const COMMENT_SPRITES: MemeSpritePack = {
  platformerEnemy: [
    '................',
    '....rrrrrrrr....',
    '...rwwwwwwwwr...',
    '..rwwkkkkkkwwr..',
    '..rwkwwwwwwkwr..',
    '..rwwwwwwwwwwr..',
    '..rwkwwkkwwkwr..',
    '..rwwwwwwwwwwr..',
    '...rrrrrrrrrr...',
    '.....r....r.....',
    '....rrr..rrr....',
    '...r..r..r..r...',
    '..rr..r..r..rr..',
    '................',
    '................',
    '................',
  ],
  platformerHazard: [
    '................',
    '.......rr.......',
    '......rrrr......',
    '.....rkkkkr.....',
    '....rkkkkkkr....',
    '...rkkkrrkkkr...',
    '..rkkrryrrkkkr..',
    '.rkkrryyyrrkkkr.',
    '.rrrrrrrrrrrrrr.',
    '....r......r....',
    '...rrr....rrr...',
    '..rrrrr..rrrrr..',
    '................',
    '................',
    '................',
    '................',
  ],
  shooterEnemy: [
    '................',
    '.....rrrrrr.....',
    '...rrwwwwwwrr...',
    '..rwwrrrrrrwwr..',
    '.rwwrwwwwwwrwwr.',
    '.rwwrkkkkkkkwwr.',
    '.rwwrwwwwwwrwwr.',
    '..rwwrrrrrrwwr..',
    '...rrwwwwwwrr...',
    '.....rrrrrr.....',
    '....r..rr..r....',
    '...rrr....rrr...',
    '................',
    '................',
    '................',
    '................',
  ],
  shooterProjectile: [
    '................',
    '................',
    '................',
    '...rrrrrrrrr....',
    '..rwwwwwwwwwr...',
    '.rwwkkkwwwwwr...',
    '.rwwwwwwwwwr....',
    '..rrrrrrrrr.....',
    '......rr........',
    '......rr........',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
  runnerObstacle: [
    '................',
    '...rrrrrrrrrr...',
    '..rwwwwwwwwwwr..',
    '.rwwkkkkkkkkwwr.',
    '.rwkwrrrrrrwkwr.',
    '.rwwwwwwwwwwwwr.',
    '.rwkwwwwwwwwkwr.',
    '.rwwkkkkkkkkwwr.',
    '..rwwwwwwwwwwr..',
    '...rrrrrrrrrr...',
    '.....rr..rr.....',
    '....rr....rr....',
    '................',
    '................',
    '................',
    '................',
  ],
  brick: [
    'rrrrrrrrrrrrrrrr',
    'rwwwwwwwwwwwwwwR',
    'rwkkkkkkkkkkkkwR',
    'rwkwwwwwwwwwwkwR',
    'rwkwwwwwwwwwwkwR',
    'rwkkkkkkkkkkkkwR',
    'rwwwwwwwwwwwwwwR',
    'rRRRRRRRRRRRRRRR',
    'rwwwwwwwwwwwwwwR',
    'rwkkkkkkkkkkkkwR',
    'rwkwwwwwwwwwwkwR',
    'rwkwwwwwwwwwwkwR',
    'rwkkkkkkkkkkkkwR',
    'rwwwwwwwwwwwwwwR',
    'rRRRRRRRRRRRRRRR',
    'RRRRRRRRRRRRRRRR',
  ],
  brickCracked: [
    'rrrrrrrrrrrrrrrr',
    'rwwwwwwwwwwwwwwR',
    'rwkkkkkkkkkkkkwR',
    'rwkwwrrrrrwwwkwR',
    'rwkwwwrrrwwwwkwR',
    'rwkkkkrkkkkkkkwR',
    'rwwwwwrwwwwwwwwR',
    'rRRRRrRRRRRRRRRR',
    'rwwwwrwwwwwwwwwR',
    'rwkkkrkkkkkkkkwR',
    'rwkwwrwwwwwwwkwR',
    'rwkwwrrwwwwwwkwR',
    'rwkkkkrrkkkkkkwR',
    'rwwwwwwwrrwwwwwR',
    'rRRRRRRRRrRRRRRR',
    'RRRRRRRRRRRRRRRR',
  ],
  ball: [
    '................',
    '................',
    '................',
    '.....rrrrrr.....',
    '....rwwwwwwr....',
    '...rwrrrrwwr....',
    '..rwwwwwwwwr....',
    '..rwwkkkwwwr....',
    '..rwwkkkwwwr....',
    '...rwwwwwwr.....',
    '....rrrrrr......',
    '......rr........',
    '......rr........',
    '................',
    '................',
    '................',
  ],
}

const ALGO_SPRITES: MemeSpritePack = {
  platformerEnemy: [
    '................',
    '.....bbbbbb.....',
    '...bbCCCCCCbb...',
    '..bCCbbbbbbCCb..',
    '.bCCbckcckcbCCb.',
    '.bCCbCCCCCCbCCb.',
    '.bCCbCkkkkCbCCb.',
    '..bCCbbbbbbCCb..',
    '...bbCCCCCCbb...',
    '.....bbbbbb.....',
    '....bb....bb....',
    '...bb......bb...',
    '..bb........bb..',
    '................',
    '................',
    '................',
  ],
  platformerHazard: [
    '................',
    '......oooo......',
    '.....oyyyyo.....',
    '....oyBBBBBo....',
    '...oyBBkkBBBo...',
    '..oyBBBkkBBBBo..',
    '.oyBBBBkkBBBBBo.',
    'oyBBBBBkkBBBBBBo',
    'oooooooooooooooo',
    '....b......b....',
    '...bbb....bbb...',
    '..bbbbb..bbbbb..',
    '................',
    '................',
    '................',
    '................',
  ],
  shooterEnemy: [
    '................',
    '......bbbb......',
    '....bbCCCCbb....',
    '...bCCbbbbCCb...',
    '..bCCbCCCCbCCb..',
    '.bCCbCbbbbCbCCb.',
    '.bCCbCCCCCCbCCb.',
    '..bCCbbbbbbCCb..',
    '...bbCCCCCCbb...',
    '....bbbbbbbb....',
    '.....o....o.....',
    '....ooo..ooo....',
    '................',
    '................',
    '................',
    '................',
  ],
  shooterProjectile: [
    '................',
    '................',
    '................',
    '....bbbbbbbb....',
    '...bCCCCCCCCb...',
    '..bCCooooCCb....',
    '.bCCCCCCCCb.....',
    '..bbbbbbbb......',
    '.....oo.........',
    '....oooo........',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
  runnerObstacle: [
    '................',
    '..bbbbbbbbbbbb..',
    '.bCCCCCCCCCCCCb.',
    '.bCbbCbbCbbCCCb.',
    '.bCCCCCCCCCCCCb.',
    '.bCoooooooooCCb.',
    '.bCokokokokoCCb.',
    '.bCoooooooooCCb.',
    '.bCCCCCCCCCCCCb.',
    '..bbbbbbbbbbbb..',
    '....oo....oo....',
    '...oooo..oooo...',
    '................',
    '................',
    '................',
    '................',
  ],
  brick: [
    'bbbbbbbbbbbbbbbb',
    'bCCCCCCCCCCCCCCB',
    'bCooooooooooooCB',
    'bCokokokokokooCB',
    'bCooooooooooooCB',
    'bCCCCCCCCCCCCCCB',
    'bBBBBBBBBBBBBBBB',
    'bCCCCCCCCCCCCCCB',
    'bCooooooooooooCB',
    'bCokokokokokooCB',
    'bCooooooooooooCB',
    'bCCCCCCCCCCCCCCB',
    'bBBBBBBBBBBBBBBB',
    'bCCCCCCCCCCCCCCB',
    'bCCCCCCCCCCCCCCB',
    'BBBBBBBBBBBBBBBB',
  ],
  brickCracked: [
    'bbbbbbbbbbbbbbbb',
    'bCCCCCCCCCCCCCCB',
    'bCoooooBBoooooCB',
    'bCokokoBBBokooCB',
    'bCooooooBBooooCB',
    'bCCCCCCCBBCCCCCB',
    'bBBBBBBBBCBBBBBB',
    'bCCCCCCBBCCCCCCB',
    'bCooooBBooooooCB',
    'bCokoBBokokokoCB',
    'bCoooBBoooooooCB',
    'bCCCCBBCCCCCCCCB',
    'bBBBBBBBBBBBBBBB',
    'bCCCCCCCCCCCCCCB',
    'bCCCCCCCCCCCCCCB',
    'BBBBBBBBBBBBBBBB',
  ],
  ball: [
    '................',
    '................',
    '................',
    '......oooo......',
    '.....oCCCCo.....',
    '....oCCBBCCo....',
    '....oCBooBCo....',
    '....oCBoCBCo....',
    '....oCCBBCCo....',
    '.....oCCCCo.....',
    '......oooo......',
    '.......oo.......',
    '................',
    '................',
    '................',
    '................',
  ],
}

const SIX_SEVEN_SPRITES: MemeSpritePack = {
  ...ALGO_SPRITES,
  platformerEnemy: [
    '................',
    '...fff..........',
    '..fyyyf.........',
    '...fff..........',
    '....f.......fff.',
    '....ff.....fyyyf',
    '.....ff.....fff.',
    '......ff.....f..',
    '......DffffffD..',
    '.....DwwwwwwwwD.',
    '.....DwkwwkwkD..',
    '.....DwwwwwwD...',
    '......DDDDDD....',
    '......D....D....',
    '.....DD....DD...',
    '................',
  ],
  platformerHazard: [
    '................',
    '...fff.....fff..',
    '..fyyyf...fyyyf.',
    '...fff.....fff..',
    '....f.......f...',
    '....ff.....ff...',
    '.....ff...ff....',
    '......ff.ff.....',
    '.......fff......',
    '......ff.ff.....',
    '.....ff...ff....',
    '....ff.....ff...',
    '...ff.......ff..',
    '..fff.......fff.',
    '................',
    '................',
  ],
  shooterEnemy: [
    '................',
    '...fff......fff.',
    '..fyyyf....fyyyf',
    '...fff......fff.',
    '....f........f..',
    '....ff......ff..',
    '.....ff....ff...',
    '..CCCCffffffCCCC',
    '.CwwwwwwwwwwwwC.',
    '.CwkkwwwwwwkkwC.',
    '..CwwwwwwwwwwC..',
    '...CCCCCCCCCC...',
    '....C......C....',
    '...CCC....CCC...',
    '................',
    '................',
  ],
  shooterProjectile: [
    '................',
    '................',
    '.....fff........',
    '....fyyyf.......',
    '.....fff........',
    '......f.........',
    '......ff........',
    '................',
    '.........fff....',
    '........fyyyf...',
    '.........fff....',
    '.........f......',
    '........ff......',
    '................',
    '................',
    '................',
  ],
  runnerObstacle: [
    '................',
    '..fff......fff..',
    '.fyyyf....fyyyf.',
    '..fff......fff..',
    '...f........f...',
    '...ff......ff...',
    '....ff....ff....',
    '.....ffffff.....',
    '....DyyyyyyD....',
    '....DwwkkwwD....',
    '.....DDDDDD.....',
    '....ff....ff....',
    '...fff....fff...',
    '................',
    '................',
    '................',
  ],
  brick: [
    'yyyyyyyyCCCCCCCC',
    'ywwwwwwyCwwwwwwC',
    'ywkkkkwyCwkkkkwC',
    'ywkwwwy.CwkwkwC.',
    'ywkkkkwyCwkkkkwC',
    'ywwwwwwyCwwwwwwC',
    'yyyyyyyyCCCCCCCC',
    '................',
    'CCCCCCCCyyyyyyyy',
    'CwwwwwwCywwwwwwy',
    'CwkkkkwCywkkkkwy',
    '.CwkwkwC.ywkwwwy',
    'CwkkkkwCywkkkkwy',
    'CwwwwwwCywwwwwwy',
    'CCCCCCCCyyyyyyyy',
    '................',
  ],
  brickCracked: [
    'yyyyyyyyCCCCCCCC',
    'ywwwrwwyCwwwrwwC',
    'ywkkrrwyCwkrrkwC',
    'ywkwwwr.CwkwrwC.',
    'ywkkkrryCwrrkkwC',
    'ywwwwwwyCwwwwwwC',
    'yyyyyyyyCCCCCCCC',
    '................',
    'CCCCCCCCyyyyyyyy',
    'CwwrwwwCywwrwwwy',
    'CwkrrkwCywkrrkwy',
    '.CwkwrwC.ywkwwry',
    'CwrrkkwCyrrkkkwy',
    'CwwwwwwCywwwwwwy',
    'CCCCCCCCyyyyyyyy',
    '................',
  ],
  ball: [
    '................',
    '.....yyyyyy.....',
    '....ywwwwwwy....',
    '...ywkkwwwwy....',
    '...ywwwwwwy.....',
    '....yyyyyy......',
    '......yy........',
    '.....CCCCCC.....',
    '....CwwwwwwC....',
    '...CwwwwkkwC....',
    '....CwwwwwwC....',
    '.....CCCCCC.....',
    '.......CC.......',
    '................',
    '................',
    '................',
  ],
}

const RIZZ_SPRITES: MemeSpritePack = {
  ...COMMENT_SPRITES,
  platformerEnemy: [
    '................',
    '.....MM..MM.....',
    '....MwwMMwwM....',
    '...MwwwwwwwwM...',
    '...MwkkwwkkwM...',
    '....MwwwwwwM....',
    '.....MwwwwM.....',
    '......MwwM......',
    '.......MM.......',
    '....MMMwwMMM....',
    '...MwwwwwwwwM...',
    '....M......M....',
    '...MM......MM...',
    '................',
    '................',
    '................',
  ],
  shooterEnemy: [
    '................',
    '......MMMM......',
    '....MMwwwwMM....',
    '...MwwMMMMwwM...',
    '..MwwMwwwwMwwM..',
    '.MwwMwwkkwwMwwM.',
    '.MwwMwwwwwwMwwM.',
    '..MwwMMMMMMwwM..',
    '...MMwwwwwwMM...',
    '....MMMMMMMM....',
    '.....M....M.....',
    '....MMM..MMM....',
    '................',
    '................',
    '................',
    '................',
  ],
  brick: [
    'MMMMMMMMMMMMMMMM',
    'MwwwwwwMMwwwwwwM',
    'MwkkkkMwwMkkkkwM',
    'MwkkkMwwwwMkkkwM',
    'MwwwMwwwwwwMwwwM',
    'MwwMwwMMMMwwMwwM',
    'MMMwwMwwwwMwwMMM',
    'MMwwMwwkkwwMwwMM',
    'MMMwwMwwwwMwwMMM',
    'MwwMwwMMMMwwMwwM',
    'MwwwMwwwwwwMwwwM',
    'MwkkkMwwwwMkkkwM',
    'MwkkkkMwwMkkkkwM',
    'MwwwwwwMMwwwwwwM',
    'MMMMMMMMMMMMMMMM',
    '................',
  ],
}

const NPC_SPRITES: MemeSpritePack = {
  ...OFFICE_SPRITES,
  platformerEnemy: [
    '................',
    '....gggggggg....',
    '...gwwwwwwwwg...',
    '..gwkkkkkkkkwg..',
    '..gwkwwkkwwkwg..',
    '..gwkkkkkkkkwg..',
    '..gwwwwwwwwwwg..',
    '...gggggggggg...',
    '....g..gg..g....',
    '....g..gg..g....',
    '...gg..gg..gg...',
    '..gwwggggggwwg..',
    '...gg......gg...',
    '................',
    '................',
    '................',
  ],
  shooterProjectile: [
    '................',
    '..gggggggggggg..',
    '.gwwwwwwwwwwwwg.',
    '.gwkkkkkkkkkkwg.',
    '.gwkggwwggkkkwg.',
    '.gwkkkkkkkkkkwg.',
    '.gwwwwwwwwwwwwg.',
    '..gggggggggggg..',
    '................',
    '..gggggggggggg..',
    '.gwwggkkggkkwwg.',
    '..gggggggggggg..',
    '................',
    '................',
    '................',
    '................',
  ],
  runnerObstacle: [
    '................',
    '..gggg..gggg....',
    '.gwwwwggwwwwg...',
    '.gwkkwggwkkwg...',
    '.gwwwwggwwwwg...',
    '..gggg..gggg....',
    '..g..g..g..g....',
    '..gggg..gggg....',
    '.gwwwwggwwwwg...',
    '.gwkkwggwkkwg...',
    '.gwwwwggwwwwg...',
    '..gggg..gggg....',
    '................',
    '................',
    '................',
    '................',
  ],
  brick: [
    'gggggggggggggggg',
    'gwwwwwwggwwwwwwg',
    'gwkkkwggggwkkkwg',
    'gwwwwwgkkgwwwwwg',
    'gggggggkkggggggg',
    'gwwwwwwggwwwwwwg',
    'gwkkkwggggwkkkwg',
    'gwwwwwwggwwwwwwg',
    'gggggggkkggggggg',
    'gwwwwwgkkgwwwwwg',
    'gwkkkwggggwkkkwg',
    'gwwwwwwggwwwwwwg',
    'gggggggggggggggg',
    '................',
    'gggggggggggggggg',
    '................',
  ],
}

function line(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null
  const s = v.replace(/\s+/g, ' ').trim()
  if (!s || s.length > max) return null
  if (URL_OR_MARKUP.test(s)) return null
  if (BLOCKED.test(s)) return null
  return s.toUpperCase()
}

function list(v: unknown, maxItems: number, maxLen: number): readonly string[] | null {
  if (!Array.isArray(v)) return null
  const out = v.map((x) => line(x, maxLen)).filter((x): x is string => x !== null)
  if (out.length === 0 || out.length > maxItems) return null
  return out
}

function flavor(v: unknown): MemeModeFlavor | null {
  if (typeof v !== 'object' || v === null) return null
  const r = v as Record<string, unknown>
  const enemy = line(r.enemy, MAX_FLAVOR)
  const obstacle = line(r.obstacle, MAX_FLAVOR)
  const hazard = line(r.hazard, MAX_FLAVOR)
  const projectile = line(r.projectile, MAX_FLAVOR)
  const brick = line(r.brick, MAX_FLAVOR)
  if (!enemy || !obstacle || !hazard || !projectile || !brick) return null
  return { enemy, obstacle, hazard, projectile, brick }
}

function modeFlavor(v: unknown): Readonly<Record<GameMode, MemeModeFlavor>> | null {
  if (typeof v !== 'object' || v === null) return null
  const r = v as Record<string, unknown>
  const out: Partial<Record<GameMode, MemeModeFlavor>> = {}
  for (const mode of ALL_MODES) {
    const f = flavor(r[mode])
    if (!f) return null
    out[mode] = f
  }
  return out as Readonly<Record<GameMode, MemeModeFlavor>>
}

function sprite(v: unknown): PixelSprite | null {
  if (!Array.isArray(v) || v.length !== SPRITE_SIZE) return null
  const rows: string[] = []
  for (const row of v) {
    if (typeof row !== 'string' || row.length !== SPRITE_SIZE) return null
    for (const ch of row) {
      if (!PIXEL_CHARS.has(ch)) return null
    }
    rows.push(row)
  }
  return rows
}

function spritePack(v: unknown, required: boolean): MemeSpritePack | undefined | null {
  if (v === undefined || v === null) return required ? null : undefined
  if (typeof v !== 'object') return null
  const r = v as Record<string, unknown>
  const out: Partial<Record<MemeSpriteRole, PixelSprite>> = {}
  for (const role of ALL_MEME_SPRITE_ROLES) {
    const s = sprite(r[role])
    if (!s) return null
    out[role] = s
  }
  return out as MemeSpritePack
}

function pattern(v: unknown, min: number, max: number): readonly number[] | null {
  if (!Array.isArray(v) || v.length === 0 || v.length > MAX_PATTERN) return null
  const out: number[] = []
  for (const n of v) {
    if (!Number.isInteger(n) || n < min || n > max) return null
    out.push(n)
  }
  return out
}

function optionalPattern(v: unknown, min: number, max: number): readonly number[] | null | undefined {
  if (v === undefined || v === null) return undefined
  return pattern(v, min, max)
}

function optionalWave(v: unknown): MusicWave | null | undefined {
  if (v === undefined || v === null) return undefined
  return typeof v === 'string' && OSC_WAVES.has(v as MusicWave) ? (v as MusicWave) : null
}

function optionalDrumKit(v: unknown): MemeMusicPlan['drumKit'] | null | undefined {
  if (v === undefined || v === null) return undefined
  return typeof v === 'string' && DRUM_KITS.has(v) ? (v as MemeMusicPlan['drumKit']) : null
}

function musicPlan(v: unknown): MemeMusicPlan | null {
  if (typeof v !== 'object' || v === null) return null
  const r = v as Record<string, unknown>
  const style = line(r.style, 32)
  const bpm = r.bpm
  const scale = r.scale
  const bassPattern = pattern(r.bassPattern, -1, 7)
  const leadPattern = pattern(r.leadPattern, -1, 7)
  const padPattern = optionalPattern(r.padPattern, -1, 7)
  const chordPattern = optionalPattern(r.chordPattern, -1, 7)
  const drumPattern = pattern(r.drumPattern, 0, 4)
  const bassWave = optionalWave(r.bassWave)
  const leadWave = optionalWave(r.leadWave)
  const padWave = optionalWave(r.padWave)
  const drumKit = optionalDrumKit(r.drumKit)
  const swing = r.swing
  const intensity = r.intensity

  if (
    !style ||
    typeof bpm !== 'number' ||
    !Number.isInteger(bpm) ||
    bpm < 90 ||
    bpm > 180 ||
    typeof scale !== 'string' ||
    !SCALES.has(scale) ||
    !bassPattern ||
    !leadPattern ||
    padPattern === null ||
    chordPattern === null ||
    !drumPattern ||
    bassWave === null ||
    leadWave === null ||
    padWave === null ||
    drumKit === null ||
    (swing !== undefined &&
      (typeof swing !== 'number' || !Number.isFinite(swing) || swing < 0 || swing > 0.35)) ||
    typeof intensity !== 'number' ||
    intensity < 0 ||
    intensity > 1
  ) {
    return null
  }

  return {
    style,
    bpm,
    scale: scale as MusicScale,
    bassPattern,
    leadPattern,
    ...(padPattern ? { padPattern } : {}),
    ...(chordPattern ? { chordPattern } : {}),
    drumPattern,
    ...(bassWave ? { bassWave } : {}),
    ...(leadWave ? { leadWave } : {}),
    ...(padWave ? { padWave } : {}),
    ...(drumKit ? { drumKit } : {}),
    ...(typeof swing === 'number' ? { swing } : {}),
    intensity,
  }
}

function musicPlans(v: unknown): readonly MemeMusicPlan[] | null | undefined {
  if (v === undefined || v === null) return undefined
  if (!Array.isArray(v) || v.length === 0 || v.length > MAX_MUSIC_PLANS) return null
  const out = v.map((p) => musicPlan(p))
  if (out.some((p) => p === null)) return null
  return out as readonly MemeMusicPlan[]
}

function partialSpritePack(v: unknown): Partial<Record<MemeSpriteRole, PixelSprite>> | null | undefined {
  if (v === undefined || v === null) return undefined
  if (typeof v !== 'object' || Array.isArray(v)) return null
  const r = v as Record<string, unknown>
  const out: Partial<Record<MemeSpriteRole, PixelSprite>> = {}
  for (const role of ALL_MEME_SPRITE_ROLES) {
    if (r[role] === undefined) continue
    const pixelRows = sprite(r[role])
    if (!pixelRows) return null
    out[role] = pixelRows
  }
  return Object.keys(out).length > 0 ? out : undefined
}

export function normaliseModeThemes(raw: unknown): Partial<Record<GameMode, MemeModeTheme>> | null | undefined {
  if (raw === undefined || raw === null) return undefined
  if (typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  const out: Partial<Record<GameMode, MemeModeTheme>> = {}

  for (const mode of ALL_MODES) {
    const rawMode = r[mode]
    if (rawMode === undefined) continue
    if (typeof rawMode !== 'object' || rawMode === null || Array.isArray(rawMode)) return null
    const m = rawMode as Record<string, unknown>
    const label = m.label === undefined ? undefined : line(m.label, MAX_LABEL)
    const palette = m.palette === undefined
      ? undefined
      : Array.isArray(m.palette)
        ? m.palette.filter((c): c is string => typeof c === 'string' && HEX.test(c)).slice(0, 4)
        : null
    const shiftLines = m.shiftLines === undefined ? undefined : list(m.shiftLines, 4, MAX_LINE)
    const taunts = m.taunts === undefined ? undefined : list(m.taunts, 5, MAX_TAUNT)
    const modeSpecificFlavor = m.modeFlavor === undefined ? undefined : flavor(m.modeFlavor)
    const sprites = partialSpritePack(m.spritePack)
    const music = m.musicPlan === undefined ? undefined : musicPlan(m.musicPlan)
    const planList = musicPlans(m.musicPlans)

    if (
      label === null ||
      palette === null ||
      (palette !== undefined && palette.length < 2) ||
      shiftLines === null ||
      taunts === null ||
      modeSpecificFlavor === null ||
      sprites === null ||
      music === null ||
      planList === null
    ) {
      return null
    }

    out[mode] = {
      ...(label ? { label } : {}),
      ...(palette ? { palette } : {}),
      ...(shiftLines ? { shiftLines } : {}),
      ...(modeSpecificFlavor ? { modeFlavor: modeSpecificFlavor } : {}),
      ...(sprites ? { spritePack: sprites } : {}),
      ...(music ? { musicPlan: music } : {}),
      ...(planList ? { musicPlans: planList } : {}),
      ...(taunts ? { taunts } : {}),
    }
  }

  return Object.keys(out).length > 0 ? out : undefined
}

function pickMusicPlan(id: string, date: string, plans: readonly MemeMusicPlan[]): MemeMusicPlan {
  const n = [...`${date}:${id}`].reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  return plans[n % plans.length]
}

function rotate<T>(items: readonly T[], amount: number): readonly T[] {
  if (items.length === 0) return items
  const n = amount % items.length
  return [...items.slice(n), ...items.slice(0, n)]
}

const MODE_THEME_TAG: Readonly<Record<GameMode, string>> = {
  [MODE.Platformer]: 'TERRAIN',
  [MODE.Shooter]: 'ORBIT',
  [MODE.Runner]: 'OVERDRIVE',
  [MODE.Brick]: 'WALL',
}

const MODE_THEME_LINE: Readonly<Record<GameMode, string>> = {
  [MODE.Platformer]: 'THE THEME LEARNED TO JUMP',
  [MODE.Shooter]: 'THE THEME ENTERED ORBIT',
  [MODE.Runner]: 'THE THEME HIT OVERDRIVE',
  [MODE.Brick]: 'THE THEME BUILT A WALL',
}

function withSelectedMusic(base: MemeTheme, date: string): MemeTheme {
  let bundleThemes: Readonly<Record<GameMode, MemeTheme>> | undefined
  if (base.bundleThemes) {
    const out = {} as Record<GameMode, MemeTheme>
    for (const mode of ALL_MODES) out[mode] = withSelectedMusic(base.bundleThemes[mode], date)
    bundleThemes = out
  }
  let themeRotations: Readonly<Record<GameMode, readonly MemeTheme[]>> | undefined
  if (base.themeRotations) {
    const out = {} as Record<GameMode, readonly MemeTheme[]>
    for (const mode of ALL_MODES) {
      out[mode] = base.themeRotations[mode].map((theme) => withSelectedMusic(theme, date))
    }
    themeRotations = out
  }
  if (!base.musicPlans?.length) {
    return {
      ...base,
      date,
      source: MEME_THEME_SOURCE.Offline,
      ...(bundleThemes ? { bundleThemes } : {}),
      ...(themeRotations ? { themeRotations } : {}),
    }
  }
  return {
    ...base,
    date,
    source: MEME_THEME_SOURCE.Offline,
    musicPlan: pickMusicPlan(base.id, date, base.musicPlans),
    ...(bundleThemes ? { bundleThemes } : {}),
    ...(themeRotations ? { themeRotations } : {}),
  }
}

function withoutBundle(raw: Record<string, unknown>): Record<string, unknown> {
  const {
    bundleThemes: _bundleThemes,
    modeThemeBundle: _modeThemeBundle,
    themeRotations: _themeRotations,
    ...rest
  } = raw
  return rest
}

function normaliseThemeBundle(
  raw: unknown,
  date: string,
  source: MemeThemeSource,
): Readonly<Record<GameMode, MemeTheme>> | null | undefined {
  if (raw === undefined || raw === null) return undefined
  if (typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  const out: Partial<Record<GameMode, MemeTheme>> = {}
  const seen = new Set<string>()
  for (const mode of ALL_MODES) {
    const value = r[mode]
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
    const theme = normaliseMemeTheme(withoutBundle(value as Record<string, unknown>), date, source)
    if (!theme) return null
    if (seen.has(theme.id)) return null
    seen.add(theme.id)
    out[mode] = { ...theme, variantId: mode }
  }
  return out as Readonly<Record<GameMode, MemeTheme>>
}

function normaliseThemeRotations(
  raw: unknown,
  date: string,
  source: MemeThemeSource,
): Readonly<Record<GameMode, readonly MemeTheme[]>> | null | undefined {
  if (raw === undefined || raw === null) return undefined
  if (typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  const out: Partial<Record<GameMode, readonly MemeTheme[]>> = {}
  for (const mode of ALL_MODES) {
    const values = r[mode]
    if (!Array.isArray(values) || values.length < 3 || values.length > 4) return null
    const themes: MemeTheme[] = []
    const seen = new Set<string>()
    for (const value of values) {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
      const theme = normaliseMemeTheme(withoutBundle(value as Record<string, unknown>), date, source)
      if (!theme) return null
      if (seen.has(theme.id)) return null
      seen.add(theme.id)
      themes.push({ ...theme, variantId: mode })
    }
    out[mode] = themes
  }
  return out as Readonly<Record<GameMode, readonly MemeTheme[]>>
}

function bundleFromCatalog(
  catalog: readonly MemeTheme[],
  date: string,
  source: MemeThemeSource,
): MemeTheme | null {
  if (catalog.length < ALL_MODES.length) return null
  const start = [...date].reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % catalog.length
  const picked = ALL_MODES.map((mode, i) => {
    const base = catalog[(start + i) % catalog.length]
    return [mode, { ...withSelectedMusic(base, date), source, variantId: mode }] as const
  })
  const bundleThemes = Object.fromEntries(picked) as Readonly<Record<GameMode, MemeTheme>>
  const base = bundleThemes[MODE.Platformer]
  return { ...base, bundleThemes }
}

function rotationsFromCatalog(
  catalog: readonly MemeTheme[],
  date: string,
  source: MemeThemeSource,
): MemeTheme | null {
  if (catalog.length < 3) return null
  const seed = [...date].reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  const themeRotations = {} as Record<GameMode, readonly MemeTheme[]>
  for (const [modeIndex, mode] of ALL_MODES.entries()) {
    const start = (seed + modeIndex) % catalog.length
    const count = Math.min(4, catalog.length)
    themeRotations[mode] = Array.from({ length: count }, (_, i) => {
      const base = catalog[(start + i) % catalog.length]
      return { ...withSelectedMusic(base, date), source, variantId: mode }
    })
  }
  const first = themeRotations[MODE.Platformer][0]
  return { ...first, themeRotations }
}

export function localDateKey(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function normaliseMemeTheme(raw: unknown, date: string, source: MemeThemeSource): MemeTheme | null {
  if (typeof raw !== 'object' || raw === null) return null
  if (!DATE.test(date)) return null
  const r = raw as Record<string, unknown>
  const id = line(r.id, MAX_ID)
  const label = line(r.label, MAX_LABEL)
  const palette = Array.isArray(r.palette)
    ? r.palette.filter((c): c is string => typeof c === 'string' && HEX.test(c)).slice(0, 4)
    : []
  const shiftLines = list(r.shiftLines, 4, MAX_LINE)
  const taunts = list(r.taunts, 5, MAX_TAUNT)
  const mode = modeFlavor(r.modeFlavor)
  const sprites = spritePack(r.spritePack, source === MEME_THEME_SOURCE.Live)
  const music = musicPlan(r.musicPlan)
  const planList = musicPlans(r.musicPlans)
  const modeThemes = normaliseModeThemes(r.modeThemes)
  const bundleThemes = normaliseThemeBundle(r.modeThemeBundle ?? r.bundleThemes, date, source)
  const themeRotations = normaliseThemeRotations(r.themeRotations, date, source)

  if (
    !id ||
    !label ||
    palette.length < 2 ||
    palette.length > 4 ||
    !shiftLines ||
    !taunts ||
    !mode ||
    sprites === null ||
    !music ||
    planList === null ||
    modeThemes === null ||
    bundleThemes === null ||
    themeRotations === null
  ) {
    return null
  }

  const selectedMusic = planList?.length ? pickMusicPlan(id, date, planList) : music

  return {
    id,
    label,
    source,
    date,
    palette,
    shiftLines,
    modeFlavor: mode,
    ...(sprites ? { spritePack: sprites } : {}),
    musicPlan: selectedMusic,
    ...(planList ? { musicPlans: planList } : {}),
    taunts,
    ...(modeThemes ? { modeThemes } : {}),
    ...(bundleThemes ? { bundleThemes } : {}),
    ...(themeRotations ? { themeRotations } : {}),
  }
}

export function themeForMode(theme: MemeTheme, mode: GameMode, shiftIndex = 0): MemeTheme {
  const rotation = theme.themeRotations?.[mode]
  if (rotation?.length) {
    const picked = rotation[Math.abs(Math.floor(shiftIndex)) % rotation.length]
    return { ...picked, variantId: `${mode}-${Math.abs(Math.floor(shiftIndex)) % rotation.length}` }
  }
  const bundled = theme.bundleThemes?.[mode]
  if (bundled) return { ...bundled, variantId: mode }
  const modeTheme = theme.modeThemes?.[mode]
  const modeIndex = ALL_MODES.indexOf(mode)
  const fallbackPlans = theme.musicPlans?.length ? rotate(theme.musicPlans, modeIndex) : undefined
  if (!modeTheme) {
    return {
      ...theme,
      variantId: mode,
      label: `${theme.label} ${MODE_THEME_TAG[mode]}`.slice(0, MAX_LABEL),
      palette: rotate(theme.palette, modeIndex),
      shiftLines: [MODE_THEME_LINE[mode], ...theme.shiftLines].slice(0, 4),
      musicPlan: fallbackPlans?.length
        ? pickMusicPlan(`${theme.id}:${mode}`, theme.date, fallbackPlans)
        : theme.musicPlan,
      ...(fallbackPlans ? { musicPlans: fallbackPlans } : {}),
    }
  }
  const plans = modeTheme.musicPlans ?? theme.musicPlans
  const musicPlan = plans?.length
    ? pickMusicPlan(`${theme.id}:${mode}`, theme.date, plans)
    : modeTheme.musicPlan ?? theme.musicPlan
  return {
    ...theme,
    variantId: mode,
    label: modeTheme.label ?? theme.label,
    palette: modeTheme.palette ?? theme.palette,
    shiftLines: modeTheme.shiftLines ?? theme.shiftLines,
    taunts: modeTheme.taunts ?? theme.taunts,
    modeFlavor: {
      ...theme.modeFlavor,
      ...(modeTheme.modeFlavor ? { [mode]: modeTheme.modeFlavor } : {}),
    },
    spritePack: modeTheme.spritePack
      ? ({ ...(theme.spritePack ?? {}), ...modeTheme.spritePack } as MemeSpritePack)
      : theme.spritePack,
    musicPlan,
    ...(plans ? { musicPlans: plans } : {}),
  }
}

export function themeBundleForDate(date = localDateKey(), adultMode = false): MemeTheme {
  const catalog = adultMode ? ADULT_MEME_THEMES : OFFLINE_MEME_THEMES
  return rotationsFromCatalog(catalog, date, MEME_THEME_SOURCE.Offline) ??
    bundleFromCatalog(catalog, date, MEME_THEME_SOURCE.Offline) ??
    (adultMode ? adultMemeThemeForDate(date) : offlineMemeThemeForDate(date))
}

export const OFFLINE_MEME_THEMES: readonly MemeTheme[] = [
  {
    id: 'office-brainrot',
    label: 'OFFICE BRAINROT',
    source: MEME_THEME_SOURCE.Offline,
    date: 'offline',
    palette: ['#3ef0ff', '#ffe14d', '#ff3ea5'],
    shiftLines: ['SYNERGY HAS ENTERED THE CHAT', 'THIS MEETING COULD HAVE BEEN A BOSS FIGHT'],
    taunts: ['CALENDAR INVITE ACCEPTED', 'ACTION ITEMS ARE SENTIENT'],
    spritePack: OFFICE_SPRITES,
    musicPlan: MUSIC.Office,
    musicPlans: [MUSIC.Office, MUSIC.ArcadeLounge, MUSIC.DebateClub],
    modeFlavor: {
      [MODE.Platformer]: { ...DEFAULT_FLAVOR, enemy: 'MANAGER BOT', hazard: 'SCOPE CREEP' },
      [MODE.Shooter]: { ...DEFAULT_FLAVOR, enemy: 'EMAIL DRONE', projectile: 'PING' },
      [MODE.Runner]: { ...DEFAULT_FLAVOR, obstacle: 'STANDUP', hazard: 'BLOCKER' },
      [MODE.Brick]: { ...DEFAULT_FLAVOR, brick: 'Q4 DECK', projectile: 'FOLLOWUP' },
    },
  },
  {
    id: 'comment-section',
    label: 'COMMENT SECTION',
    source: MEME_THEME_SOURCE.Offline,
    date: 'offline',
    palette: ['#ff4d4d', '#3ef0ff', '#4dff9a'],
    shiftLines: ['THE REPLIES ARE MATERIALIZING', 'DO NOT READ THE QUOTE POSTS'],
    taunts: ['RATIO DETECTED', 'THREAD MUTED TOO LATE'],
    spritePack: COMMENT_SPRITES,
    musicPlan: MUSIC.Comment,
    musicPlans: [MUSIC.Comment, MUSIC.DebateClub, MUSIC.WarRoomPulse],
    modeFlavor: {
      [MODE.Platformer]: { ...DEFAULT_FLAVOR, enemy: 'REPLY GUY', hazard: 'RATIO' },
      [MODE.Shooter]: { ...DEFAULT_FLAVOR, enemy: 'TAKE DRONE', projectile: 'QUOTE POST' },
      [MODE.Runner]: { ...DEFAULT_FLAVOR, obstacle: 'DISCOURSE', hazard: 'DOGPILE' },
      [MODE.Brick]: { ...DEFAULT_FLAVOR, brick: 'TAKE WALL', projectile: 'DUNK' },
    },
  },
  {
    id: 'algorithm-soup',
    label: 'ALGORITHM SOUP',
    source: MEME_THEME_SOURCE.Offline,
    date: 'offline',
    palette: ['#4d7cff', '#ff9a2e', '#f2eeff'],
    shiftLines: ['THE FEED HAS CHOSEN VIOLENCE', 'ENGAGEMENT BAIT ARMED'],
    taunts: ['FOR YOU PAGE FORGOT YOU', 'OPTIMIZED FOR PANIC'],
    spritePack: ALGO_SPRITES,
    musicPlan: MUSIC.Algo,
    musicPlans: [MUSIC.Algo, MUSIC.ArcadeLounge, MUSIC.BorderWallBounce],
    modeFlavor: {
      [MODE.Platformer]: { ...DEFAULT_FLAVOR, enemy: 'FEED BOT', hazard: 'BAIT PIT' },
      [MODE.Shooter]: { ...DEFAULT_FLAVOR, enemy: 'BOT SWARM', projectile: 'CLICKBAIT' },
      [MODE.Runner]: { ...DEFAULT_FLAVOR, obstacle: 'AUTO PLAY', hazard: 'SCROLL TRAP' },
      [MODE.Brick]: { ...DEFAULT_FLAVOR, brick: 'FEED BLOCK', projectile: 'BOOST' },
    },
  },
  {
    id: 'six-seven',
    label: 'SIX SEVEN',
    source: MEME_THEME_SOURCE.Offline,
    date: 'offline',
    palette: ['#ffe14d', '#3ef0ff', '#ff3ea5'],
    shiftLines: ['SIX SEVEN DETECTED', 'THE NUMBERS MEAN NOTHING AND EVERYTHING'],
    taunts: ['SIX UP SEVEN DOWN', 'BALANCE THE FEED'],
    spritePack: SIX_SEVEN_SPRITES,
    musicPlan: MUSIC.SixSeven,
    musicPlans: [MUSIC.SixSeven, MUSIC.BorderWallBounce, MUSIC.RallyStomp],
    modeFlavor: {
      [MODE.Platformer]: { ...DEFAULT_FLAVOR, enemy: 'UP DOWN', hazard: '👋 ↕ 👋' },
      [MODE.Shooter]: { ...DEFAULT_FLAVOR, enemy: 'HAND EDIT', projectile: 'SIX SEVEN' },
      [MODE.Runner]: { ...DEFAULT_FLAVOR, obstacle: 'UP DOWN', hazard: '👋 6 / 7 👋' },
      [MODE.Brick]: { ...DEFAULT_FLAVOR, brick: '67 WALL', projectile: 'BOUNCE EDIT' },
    },
  },
  {
    id: 'rizz-circuit',
    label: 'RIZZ CIRCUIT',
    source: MEME_THEME_SOURCE.Offline,
    date: 'offline',
    palette: ['#ff3ea5', '#f2eeff', '#4d7cff'],
    shiftLines: ['CHARISMA OVERCLOCKED', 'THE CIRCUIT HAS TOO MUCH RIZZ'],
    taunts: ['SMOOTH INPUT', 'AURA BUFFER FULL'],
    spritePack: RIZZ_SPRITES,
    musicPlan: MUSIC.Rizz,
    musicPlans: [MUSIC.Rizz, MUSIC.ArcadeLounge, MUSIC.IslandNoir],
    modeFlavor: {
      [MODE.Platformer]: { ...DEFAULT_FLAVOR, enemy: 'AURA BOT', hazard: 'CRINGE FIELD' },
      [MODE.Shooter]: { ...DEFAULT_FLAVOR, enemy: 'RIZZ DRONE', projectile: 'AURA BEAM' },
      [MODE.Runner]: { ...DEFAULT_FLAVOR, obstacle: 'VIBE CHECK', hazard: 'AURA TAX' },
      [MODE.Brick]: { ...DEFAULT_FLAVOR, brick: 'AURA WALL', projectile: 'CHARM BALL' },
    },
  },
  {
    id: 'npc-stream',
    label: 'NPC STREAM',
    source: MEME_THEME_SOURCE.Offline,
    date: 'offline',
    palette: ['#4dff9a', '#ffe14d', '#3ef0ff'],
    shiftLines: ['THANK YOU FOR THE LOOP', 'REACTION SCRIPT RELOADED'],
    taunts: ['IDLE ANIMATION WON', 'SCRIPTED BUT DANGEROUS'],
    spritePack: NPC_SPRITES,
    musicPlan: MUSIC.Npc,
    musicPlans: [MUSIC.Npc, MUSIC.Comment, MUSIC.ArcadeLounge],
    modeFlavor: {
      [MODE.Platformer]: { ...DEFAULT_FLAVOR, enemy: 'NPC LOOP', hazard: 'SCRIPT BUG' },
      [MODE.Shooter]: { ...DEFAULT_FLAVOR, enemy: 'STREAM BOT', projectile: 'CHAT PING' },
      [MODE.Runner]: { ...DEFAULT_FLAVOR, obstacle: 'LOOP CLIP', hazard: 'BIT RUSH' },
      [MODE.Brick]: { ...DEFAULT_FLAVOR, brick: 'CHAT WALL', projectile: 'BIT BALL' },
    },
  },
]

const DEBATE_SPRITES: MemeSpritePack = {
  platformerEnemy: [
    '................',
    '.....oooooo.....',
    '....owwwwwwo....',
    '...owkkkkkkwo...',
    '...owkwkkwkwo...',
    '....owwwwwwo....',
    '......BBBB......',
    '.....BwwwwB.....',
    '....BBBBBBBB....',
    '...BwwBwwBwwB...',
    '..BBBBBBBBBBBB..',
    '..BkkkkkkkkkkB..',
    '..BBBBBBBBBBBB..',
    '................',
    '................',
    '................',
  ],
  platformerHazard: [
    '................',
    '.....mmmmmm.....',
    '....mwwwwwwm....',
    '...mwwkkkkwm....',
    '..mwwwwwwwwm....',
    '..mmmmmmmmmm....',
    '......MM........',
    '.....MMMM.......',
    '....MwwwwM......',
    '....MMMMMM......',
    '.....MMMM.......',
    '......MM........',
    '................',
    '................',
    '................',
    '................',
  ],
  shooterEnemy: [
    '................',
    '....BBBBBBBB....',
    '..BBwwwwwwwwBB..',
    '.BwwkkkkkkkkwwB.',
    '.BwkwwwwwwwwkwB.',
    '.BwwwwwwwwwwwwB.',
    '..BBBBBBBBBBBB..',
    '...B..BBBB..B...',
    '..BBB......BBB..',
    '.B..........B...',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
  shooterProjectile: [
    '................',
    '................',
    '.....mmmmmm.....',
    '....mwwwwwwm....',
    '...mwwkkkkwm....',
    '...mwwwwwwm.....',
    '....mmmmmm......',
    '......MM........',
    '.....MMMM.......',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
  runnerObstacle: [
    '................',
    '..BBBBBBBBBBBB..',
    '.BwwwwwwwwwwwwB.',
    '.BwkkkkkkkkkkwB.',
    '.BwwwwwwwwwwwwB.',
    '..BBBBBBBBBBBB..',
    '....B......B....',
    '....B......B....',
    '..BBBBBBBBBBBB..',
    '..BkkkkkkkkkkB..',
    '..BBBBBBBBBBBB..',
    '...B........B...',
    '..BB........BB..',
    '................',
    '................',
    '................',
  ],
  brick: [
    'BBBBBBBBBBBBBBBB',
    'BwwwwwwwwwwwwwwB',
    'BwkkkkkkkkkkkkwB',
    'BwkwwwwwwwwwwkwB',
    'BwwwwwwwwwwwwwwB',
    'BBBBBBBBBBBBBBBB',
    'BmmmmmmmmmmmmmmB',
    'BmwwwwwwwwwwwwmB',
    'BmkkkkkkkkkkkkmB',
    'BmwwwwwwwwwwwwmB',
    'BmmmmmmmmmmmmmmB',
    'BBBBBBBBBBBBBBBB',
    'BkkkkkkkkkkkkkkB',
    'BBBBBBBBBBBBBBBB',
    'BwwwwwwwwwwwwwwB',
    'BBBBBBBBBBBBBBBB',
  ],
  brickCracked: [
    'BBBBBBBBBBBBBBBB',
    'BwwwwwwmmwwwwwwB',
    'BwkkkkkmMkkkkkwB',
    'BwkwwwmMwwwwwkwB',
    'BwwwwmMwwwwwwwwB',
    'BBBBmMBBBBBBBBBB',
    'BmmmMmmmmmmmmmmB',
    'BmwmMwwwwwwwwwmB',
    'BmkMkkkkkkkkkkmB',
    'BmwMwwwwwwwwwwmB',
    'BmMmmmmmmmmmmmmB',
    'BBMBBBBBBBBBBBBB',
    'BMkkkkkkkkkkkkkB',
    'BBBBBBBBBBBBBBBB',
    'BwwwwwwwwwwwwwwB',
    'BBBBBBBBBBBBBBBB',
  ],
  ball: [
    '................',
    '......MMMM......',
    '.....MwwwwM.....',
    '....MwwkkwM.....',
    '....MwwwwwM.....',
    '.....MMMMM......',
    '......MM........',
    '.....MMMM.......',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
}

const TABLOID_SPRITES: MemeSpritePack = {
  platformerEnemy: [
    '................',
    '....wwwwww......',
    '...wkkkkkkw.....',
    '..wkwwwwwwkw....',
    '..wkwkkwkkww....',
    '..wkkkkkkkw.....',
    '...wwwwwww......',
    '....dRRRRd......',
    '...dRwwwwRd.....',
    '..dRRRRRRRRd....',
    '..dRwwRRwwRd....',
    '...dRRRRRRd.....',
    '....d....d......',
    '...dd....dd.....',
    '................',
    '................',
  ],
  platformerHazard: [
    '................',
    '....rrrrrrrr....',
    '...rwwwwwwwwr...',
    '..rwkkkkkkwwr...',
    '..rwkrrrrkwr....',
    '..rwkkkkkwr.....',
    '..rwwwwwwr......',
    '..rrrrrrr.......',
    '.....rr.........',
    '....rrrr........',
    '...rr..rr.......',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
  shooterEnemy: [
    '................',
    '....wwwwww......',
    '...wkkkkkkw.....',
    '..wkwwkkwwkw....',
    '..wkwkkkkkww....',
    '..wkkkkkkkw.....',
    '...wwwwwww......',
    '..RRRRRRRRRR....',
    '.RwwRRwwRRwwR...',
    '..RRRRRRRRRR....',
    '...R......R.....',
    '..RR......RR....',
    '................',
    '................',
    '................',
    '................',
  ],
  shooterProjectile: [
    '................',
    '................',
    '..kkkkkkkkkk....',
    '.kwwwwwwwwwwk...',
    '.kwrrrrrrrrwk...',
    '.kwwwwwwwwwwk...',
    '..kkkkkkkkkk....',
    '.....rr.........',
    '....rrrr........',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
  runnerObstacle: [
    '................',
    '....wwwwwwww....',
    '...wkkkkkkkkw...',
    '..wkwwwwwwwwkw..',
    '..wkwkkwkkwkw...',
    '..wkkkkkkkkw....',
    '...wwwwwwww.....',
    '..RRRRRRRRRR....',
    '.RwwRRwwRRwwR...',
    '..RRRRRRRRRR....',
    '...R......R.....',
    '..RR......RR....',
    '................',
    '................',
    '................',
    '................',
  ],
  brick: [
    'yyyyyyyyyyyyyyyy',
    'ywwwwwwwwwwwwwwy',
    'ywkkkkkkkkkkkkwy',
    'ywkrrrrrrrrrrkwy',
    'ywkkkkkkkkkkkkwy',
    'ywwwwwwwwwwwwwwy',
    'yyyyyyyyyyyyyyyy',
    'ykkkkkkkkkkkkkky',
    'ykrkrkrkrkrkrkky',
    'ykkkkkkkkkkkkkky',
    'yyyyyyyyyyyyyyyy',
    'ywwwwwwwwwwwwwwy',
    'ywkkkkkkkkkkkkwy',
    'ywwwwwwwwwwwwwwy',
    'yyyyyyyyyyyyyyyy',
    'yyyyyyyyyyyyyyyy',
  ],
  brickCracked: [
    'yyyyyyyyyyyyyyyy',
    'ywwwwwrrwwwwwwwy',
    'ywkkkkrRkkkkkkwy',
    'ywkrRrrrrrrrrkwy',
    'ywkkkRkkkkkkkkwy',
    'ywwwRwwwwwwwwwwy',
    'yyyRyyyyyyyyyyyy',
    'ykRkkkkkkkkkkkky',
    'yRrkrkrkrkrkrkky',
    'ykkkkkkkkkkkkkky',
    'yyyyyyyyyyyyyyyy',
    'ywwwwwwwwwwwwwwy',
    'ywkkkkkkkkkkkkwy',
    'ywwwwwwwwwwwwwwy',
    'yyyyyyyyyyyyyyyy',
    'yyyyyyyyyyyyyyyy',
  ],
  ball: [
    '................',
    '......kkkk......',
    '....kkwwwwkk....',
    '...kwwrrrrwk....',
    '..kwwwwwwwwk....',
    '..kkkkkkkkk.....',
    '.....rr.........',
    '....rrrr........',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
}

const MAGA_SPRITES: MemeSpritePack = {
  platformerEnemy: [
    '................',
    '....B.....B.....',
    '...Bww...Bww....',
    '..BwwwwBBwwwB...',
    '.BwwwwwwwwwwB...',
    '.BwkwwwwwwkwB...',
    '.BwwwwkwkwwwB...',
    '..BBBBwwwwwwB...',
    '.....BBBBBBBB...',
    '......B....B....',
    '.....BB...BB....',
    '....BB....BB....',
    '................',
    '................',
    '................',
    '................',
  ],
  platformerHazard: [
    '................',
    '..rrrrrrrrrrrr..',
    '.rwwwwwwwwwwwwr.',
    '.rwkkkkkkkkkkwr.',
    '.rwwwwwwwwwwwwr.',
    '..rrrrrrrrrrrr..',
    '.....r....r.....',
    '....rr....rr....',
    '...rr......rr...',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
  shooterEnemy: [
    '................',
    '....B.....B.....',
    '...Bww...Bww....',
    '..BwwwwBBwwwB...',
    '.BwwwwwwwwwwB...',
    '.BwkwwwwwwkwB...',
    '.BwwwwkwkwwwB...',
    '..BBBBwwwwwwB...',
    '.....BBBBBBBB...',
    '......B....B....',
    '.....BB...BB....',
    '....BB....BB....',
    '................',
    '................',
    '................',
    '................',
  ],
  shooterProjectile: [
    '................',
    '................',
    '...rrrrrrrr.....',
    '..rwwwwwwwwr....',
    '.rwkkkkkkwwr....',
    '..rwwwwwwr......',
    '...rrrrrr.......',
    '.....rr.........',
    '....rrrr........',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
  runnerObstacle: [
    '................',
    '....B.....B.....',
    '...Bww...Bww....',
    '..BwwwwBBwwwB...',
    '.BwwwwwwwwwwB...',
    '.BwkwwwwwwkwB...',
    '.BwwwwkwkwwwB...',
    '..BBBBwwwwwwB...',
    '.....BBBBBBBB...',
    '......B....B....',
    '.....BB...BB....',
    '....BB....BB....',
    '................',
    '................',
    '................',
    '................',
  ],
  brick: [
    'DDDDDDDDDDDDDDDD',
    'DwwwwwwwwwwwwwwD',
    'DwDDDDDDDDDDDDwD',
    'DwDwwwwwwwwwwDwD',
    'DwDDDDDDDDDDDDwD',
    'DwwwwwwwwwwwwwwD',
    'DDDDDDDDDDDDDDDD',
    'DWWWWWWWWWWWWWWD',
    'DWDWDWDWDWDWDWDD',
    'DWWWWWWWWWWWWWWD',
    'DDDDDDDDDDDDDDDD',
    'DwwwwwwwwwwwwwwD',
    'DwDDDDDDDDDDDDwD',
    'DwwwwwwwwwwwwwwD',
    'DDDDDDDDDDDDDDDD',
    'DDDDDDDDDDDDDDDD',
  ],
  brickCracked: [
    'DDDDDDDDDDDDDDDD',
    'DwwwwwrrwwwwwwwD',
    'DwDDDDDrRDDDDDwD',
    'DwDwwwrRwwwwwDwD',
    'DwDDDDrRDDDDDDwD',
    'DwwwwRwwwwwwwwwD',
    'DDDDDrDDDDDDDDDD',
    'DWWWWRWWWWWWWWWD',
    'DWDWDrDWDWDWDWDD',
    'DWWWrWWWWWWWWWWD',
    'DDDrDDDDDDDDDDDD',
    'DwwRwwwwwwwwwwwD',
    'DwRDDDDDDDDDDDwD',
    'DwwwwwwwwwwwwwwD',
    'DDDDDDDDDDDDDDDD',
    'DDDDDDDDDDDDDDDD',
  ],
  ball: [
    '................',
    '.....rrrrrr.....',
    '....rwwwwwwr....',
    '...rwkkkkwwr....',
    '..rwwwoowwwr....',
    '..rwwwwwwwwr....',
    '...rrrrrrrr.....',
    '.....BB.........',
    '....BBBB........',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
}

const TABLOID_UPGRADED_SPRITES: MemeSpritePack = {
  ...TABLOID_SPRITES,
  platformerEnemy: [
    '................',
    '......wwww......',
    '.....wkkkkw.....',
    '.....wkwkwk.....',
    '.....wkkkkw.....',
    '......wwww......',
    '.......R........',
    '....RRRRRRR.....',
    '...RwwRRRwwR....',
    '...RwwRRRwwR....',
    '....RRRRRRR.....',
    '...RR.....RR....',
    '..RkkR...RkkR...',
    '..RkkRRRRRkkR...',
    '...RR.....RR....',
    '................',
  ],
  platformerHazard: [
    '................',
    '..yyyyyyyyyy....',
    '.ywwwwwwwwwy....',
    '.ywkkkkkkwwy....',
    '.ywwwwwwwwwy....',
    '..yyyyyyyyyy....',
    '....rrrrrrrr....',
    '...rwwwwwwwr....',
    '...rwkkkkwwr....',
    '...rwwwwwwwr....',
    '....rrrrrrrr....',
    '......yyyyyy....',
    '.....ywwwwwy....',
    '.....ywkkwwy....',
    '.....yyyyyy.....',
    '................',
  ],
  shooterEnemy: [
    '................',
    '.......ww.......',
    '......wkkw......',
    '.....wkkkkw.....',
    '....wwwwwwww....',
    '...wkkkkkkkkw...',
    '..wwwwwwwwwwww..',
    '.wwkkkkkkkkkkww.',
    'wwwwwwwwwwwwwwww',
    '....wwwwwwww....',
    '...ww..kk..ww...',
    '..ww....kk..ww..',
    '.......kkkk.....',
    '......ww..ww....',
    '................',
    '................',
  ],
  shooterProjectile: [
    '................',
    '................',
    '....yyyyyyyy....',
    '...ywwwwwwwy....',
    '..ywkkrrkkwy....',
    '...ywwwwwwwy....',
    '....yyyyyyyy....',
    '......rr........',
    '.....rrrr.......',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
  runnerObstacle: [
    '................',
    '..yyyyyyyyyyy...',
    '.ywwwwwwwwwwy...',
    '.ywkkkkkkkwwy...',
    '.ywwwwwwwwwwy...',
    '..yyyyyyyyyyy...',
    '...rrrrrrrrrr...',
    '..rwwwwwwwwwr...',
    '..rwkkkkkkwwr...',
    '..rwwwwwwwwwr...',
    '...rrrrrrrrrr...',
    '....yyyyyyyyy...',
    '...ywwwwwwwwy...',
    '...ywkkkrrkwy...',
    '...ywwwwwwwwy...',
    '....yyyyyyyy....',
  ],
}

const KIRK_SPRITES: MemeSpritePack = {
  platformerEnemy: [
    '................',
    '.....mmmmmm.....',
    '....mbbbbbbm....',
    '...mbbkkkkbbm...',
    '...mbkwkkwkbm...',
    '....mbbbbbm.....',
    '.....wwww.......',
    '....wccccw......',
    '...wccccccw.....',
    '..wccwcwcccw....',
    '...cccccccc.....',
    '....c....c......',
    '...cc....cc.....',
    '................',
    '................',
    '................',
  ],
  platformerHazard: [
    '................',
    '..rrrrrrrrrrrr..',
    '..oooooooooooo..',
    '..yyyyyyyyyyyy..',
    '..gggggggggggg..',
    '..cccccccccccc..',
    '..bbbbbbbbbbbb..',
    '..mmmmmmmmmmmm..',
    '...rrrrrrrrrr...',
    '....yyyyyyyy....',
    '.....cccccc.....',
    '......mmmm......',
    '................',
    '................',
    '................',
    '................',
  ],
  shooterEnemy: [
    '................',
    '.....bbbbbb.....',
    '....bmmmmmm.....',
    '...bmwwkkwwm....',
    '..bmmwkkkkwm....',
    '...bmmwwwwm.....',
    '.....cccc.......',
    '....cwwwwc......',
    '...cccccccc.....',
    '..cwwcwwcwwc....',
    '...cccccccc.....',
    '....m....m......',
    '...mm....mm.....',
    '................',
    '................',
    '................',
  ],
  shooterProjectile: [
    '................',
    '................',
    '.....r..........',
    '.....ro.........',
    '.....roy........',
    '.....royg.......',
    '.....roygc......',
    '.....roygcb.....',
    '.....roygcbm....',
    '.....roygcb.....',
    '.....roygc......',
    '.....royg.......',
    '.....roy........',
    '................',
    '................',
    '................',
  ],
  runnerObstacle: [
    '................',
    '..rrrrrrrrrrrr..',
    '..oooooooooooo..',
    '..yyyyyyyyyyyy..',
    '..gggggggggggg..',
    '..cccccccccccc..',
    '..bbbbbbbbbbbb..',
    '..mmmmmmmmmmmm..',
    '..rrrrrrrrrrrr..',
    '..oooooooooooo..',
    '..yyyyyyyyyyyy..',
    '..gggggggggggg..',
    '..cccccccccccc..',
    '..bbbbbbbbbbbb..',
    '..mmmmmmmmmmmm..',
    '................',
  ],
  brick: [
    'rrrrrrrrrrrrrrrr',
    'oooooooooooooooo',
    'yyyyyyyyyyyyyyyy',
    'gggggggggggggggg',
    'cccccccccccccccc',
    'bbbbbbbbbbbbbbbb',
    'mmmmmmmmmmmmmmmm',
    'rrrrrrrrrrrrrrrr',
    'oooooooooooooooo',
    'yyyyyyyyyyyyyyyy',
    'gggggggggggggggg',
    'cccccccccccccccc',
    'bbbbbbbbbbbbbbbb',
    'mmmmmmmmmmmmmmmm',
    'rrrrrrrrrrrrrrrr',
    'oooooooooooooooo',
  ],
  brickCracked: [
    'rrrrrrkkrrrrrrrr',
    'ooooookkoooooooo',
    'yyyyykrrkyyyyyyy',
    'gggggkrrkggggggg',
    'cccckrrrrkcccccc',
    'bbbbkrrrrkbbbbbb',
    'mmmkrmmmmkmmmmmm',
    'rrrkrrrrrrkrrrrr',
    'ooookkoooooooooo',
    'yyyyykkyyyyyyyyy',
    'ggggkrrkgggggggg',
    'ccckrrrrkccccccc',
    'bbbkrrrrkbbbbbbb',
    'mmkmmmmmmkmmmmmm',
    'rrrrrrrrrrrrrrrr',
    'oooooooooooooooo',
  ],
  ball: [
    '................',
    '.....mmmmmm.....',
    '....mccccccm....',
    '...mcyyyyccm....',
    '..mcyrooyycm....',
    '..mcyyyyyycm....',
    '...mccccccm.....',
    '.....mmmm.......',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
}

export const ADULT_MEME_THEMES: readonly MemeTheme[] = [
  {
    id: 'debate-afterparty',
    label: 'DEBATE AFTERPARTY',
    source: MEME_THEME_SOURCE.Offline,
    date: 'adult',
    palette: ['#4d7cff', '#ff3ea5', '#f2eeff'],
    shiftLines: ['THE PANEL HAS LOST THE PLOT', 'HOT TAKES NEED A PERMIT'],
    taunts: ['CHARLIE KIRK CLIP FARM', 'THE MIC STAYED ON'],
    spritePack: DEBATE_SPRITES,
    musicPlan: MUSIC.Rizz,
    musicPlans: [MUSIC.Rizz, MUSIC.DebateClub, MUSIC.WarRoomPulse, MUSIC.ArcadeLounge],
    modeFlavor: {
      [MODE.Platformer]: { ...DEFAULT_FLAVOR, enemy: 'PODIUM GUY', hazard: 'CLIP FARM' },
      [MODE.Shooter]: { ...DEFAULT_FLAVOR, enemy: 'DEBATE DRONE', projectile: 'SOUND BITE' },
      [MODE.Runner]: { ...DEFAULT_FLAVOR, obstacle: 'PANEL DESK', hazard: 'HOT SEAT' },
      [MODE.Brick]: { ...DEFAULT_FLAVOR, brick: 'TAKE WALL', projectile: 'MIC DROP' },
    },
  },
  {
    id: 'tabloid-island',
    label: 'TABLOID ISLAND',
    source: MEME_THEME_SOURCE.Offline,
    date: 'adult',
    palette: ['#ffe14d', '#ff4d4d', '#f2eeff'],
    shiftLines: ['EPSTEIN FILES GOT ARCADE PHYSICS', 'PRIVATE JET ENTERED THE FEED'],
    taunts: ['CASE FILE STACKED AGAIN', 'ISLAND CAMERA DENIED'],
    spritePack: TABLOID_UPGRADED_SPRITES,
    musicPlan: MUSIC.Algo,
    musicPlans: [MUSIC.Algo, MUSIC.IslandNoir, MUSIC.ArcadeLounge],
    modeFlavor: {
      [MODE.Platformer]: { ...DEFAULT_FLAVOR, enemy: 'SUIT FILE', hazard: 'CASE FILE' },
      [MODE.Shooter]: { ...DEFAULT_FLAVOR, enemy: 'PRIVATE JET', projectile: 'FILE TAB' },
      [MODE.Runner]: { ...DEFAULT_FLAVOR, obstacle: 'CASE FILE', hazard: 'RED TAPE' },
      [MODE.Brick]: { ...DEFAULT_FLAVOR, brick: 'FILE WALL', projectile: 'TABLOID' },
    },
  },
  {
    id: 'maga-rally',
    label: 'MAGA RALLY',
    source: MEME_THEME_SOURCE.Offline,
    date: 'adult',
    palette: ['#ff4d4d', '#4d7cff', '#f2eeff'],
    shiftLines: ['CHINA LABELS HIT THE RALLY FLOOR', 'FAKE NEWS PROJECTILES ONLINE'],
    taunts: ['QUITE FRANKLY, THAT MISSED', "I'M THE BEST ONE BTW"],
    spritePack: MAGA_SPRITES,
    musicPlan: MUSIC.SixSeven,
    musicPlans: [MUSIC.SixSeven, MUSIC.RallyStomp, MUSIC.BorderWallBounce],
    modeFlavor: {
      [MODE.Platformer]: { ...DEFAULT_FLAVOR, enemy: 'MAGA', hazard: 'FAKE NEWS' },
      [MODE.Shooter]: { ...DEFAULT_FLAVOR, enemy: 'DONKEY', projectile: 'CHINA' },
      [MODE.Runner]: { ...DEFAULT_FLAVOR, obstacle: 'QUITE FRANKLY', hazard: 'FAKE NEWS' },
      [MODE.Brick]: { ...DEFAULT_FLAVOR, brick: 'MAGA WALL', projectile: 'CAP BALL' },
    },
  },
  {
    id: 'kirk-mode',
    label: 'KIRK MODE',
    source: MEME_THEME_SOURCE.Offline,
    date: 'adult',
    palette: ['#4d7cff', '#ff3ea5', '#ffe14d', '#4dff9a'],
    shiftLines: ['TURNING POINT ENTERED CHAT', 'WOKE LABELS HIT THE FIELD'],
    taunts: ['TURNING POINT BONUS ROUND', 'WOKE PROJECTILE MISSED'],
    spritePack: KIRK_SPRITES,
    musicPlan: MUSIC.KirkMarch,
    musicPlans: [MUSIC.KirkMarch, MUSIC.KirkInterlude, MUSIC.KirkBridge],
    modeFlavor: {
      [MODE.Platformer]: { ...DEFAULT_FLAVOR, enemy: 'BLUE HAIR', hazard: 'WOKE' },
      [MODE.Shooter]: { ...DEFAULT_FLAVOR, enemy: 'PURPLE HAIR', projectile: 'WOKE' },
      [MODE.Runner]: { ...DEFAULT_FLAVOR, obstacle: 'TURNING POINT', hazard: 'WOKE' },
      [MODE.Brick]: { ...DEFAULT_FLAVOR, brick: 'TURNING POINT', projectile: 'WOKE' },
    },
  },
]

export function offlineMemeThemeForDate(date = localDateKey()): MemeTheme {
  const n = [...date].reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  const base = OFFLINE_MEME_THEMES[n % OFFLINE_MEME_THEMES.length]
  return withSelectedMusic(base, date)
}

export const OFFLINE_MEME_THEME_IDS: readonly string[] = OFFLINE_MEME_THEMES.map((t) => t.id)
export const ADULT_MEME_THEME_IDS: readonly string[] = ADULT_MEME_THEMES.map((t) => t.id)

export function offlineMemeThemeById(id: string | null | undefined, date = localDateKey()): MemeTheme | null {
  if (!id) return null
  const base = OFFLINE_MEME_THEMES.find((t) => t.id === id)
  return base ? withSelectedMusic(base, date) : null
}

export function adultMemeThemeForDate(date = localDateKey()): MemeTheme {
  const n = [...date].reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  const base = ADULT_MEME_THEMES[n % ADULT_MEME_THEMES.length]
  return withSelectedMusic(base, date)
}

export function adultMemeThemeById(id: string | null | undefined, date = localDateKey()): MemeTheme | null {
  if (!id) return null
  const base = ADULT_MEME_THEMES.find((t) => t.id === id)
  return base ? withSelectedMusic(base, date) : null
}

export function memeAccent(theme: MemeTheme, index: number, fallback = '#3ef0ff'): string {
  return theme.palette[index % theme.palette.length] ?? fallback
}

export function memeAccentNumber(theme: MemeTheme, index: number, fallback = 0x3ef0ff): number {
  const c = memeAccent(theme, index)
  return HEX.test(c) ? Number.parseInt(c.slice(1), 16) : fallback
}
