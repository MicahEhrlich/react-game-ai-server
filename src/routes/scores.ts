import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { FastifyInstance } from 'fastify'
import type { PgPool } from '../db.ts'
import { allowRequestAsync, RATE_LIMITS } from '../rateLimit.ts'

export interface ScoreEntry {
  readonly name: string
  readonly score: number
  readonly shifts: number
  readonly at: number
}

interface ScoreStore {
  top(limit: number): Promise<ScoreEntry[]>
  submit(entry: ScoreEntry): Promise<ScoreEntry[]>
}

const MAX_STORED = 100
const NAME = /^[A-Z0-9 ]{1,12}$/

function ipFrom(headers: Record<string, unknown>, remoteAddress?: string): string {
  const forwarded = headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.trim()) return forwarded.split(',')[0]?.trim() ?? 'unknown'
  return remoteAddress ?? 'unknown'
}

function normaliseLimit(raw: unknown): number {
  const n = Number(raw ?? 10)
  return Number.isFinite(n) ? Math.max(1, Math.min(100, Math.floor(n))) : 10
}

export function normaliseScoreEntry(raw: unknown, now = Date.now()): ScoreEntry | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  const name = typeof r.name === 'string' ? r.name.replace(/\s+/g, ' ').trim().toUpperCase().slice(0, 12) : ''
  const score = Number(r.score)
  const shifts = Number(r.shifts)
  const at = Number(r.at)
  if (!NAME.test(name)) return null
  if (!Number.isInteger(score) || score <= 0 || score > 999_999_999) return null
  if (!Number.isInteger(shifts) || shifts < 0 || shifts > 9999) return null
  return {
    name,
    score,
    shifts,
    at: Number.isFinite(at) && at > 0 ? Math.floor(at) : now,
  }
}

function sortScores(entries: readonly ScoreEntry[]): ScoreEntry[] {
  return [...entries]
    .sort((a, b) => b.score - a.score || b.shifts - a.shifts || a.at - b.at)
    .slice(0, MAX_STORED)
}

function rowToEntry(row: { name: string; score: number; shifts: number; client_at: string | number | null; created_at: Date | string }): ScoreEntry {
  return {
    name: row.name,
    score: Number(row.score),
    shifts: Number(row.shifts),
    at: row.client_at === null ? new Date(row.created_at).getTime() : Number(row.client_at),
  }
}

export class FileScoreStore implements ScoreStore {
  private readonly file: string

  constructor(file: string) {
    this.file = file
  }

  async top(limit: number): Promise<ScoreEntry[]> {
    return (await this.read()).slice(0, limit)
  }

  async submit(entry: ScoreEntry): Promise<ScoreEntry[]> {
    const next = sortScores([...(await this.read()), entry])
    await mkdir(dirname(this.file), { recursive: true })
    await writeFile(this.file, JSON.stringify(next, null, 2), 'utf8')
    return next
  }

  private async read(): Promise<ScoreEntry[]> {
    try {
      const parsed = JSON.parse(await readFile(this.file, 'utf8')) as unknown
      if (!Array.isArray(parsed)) return []
      return sortScores(parsed.map((entry) => normaliseScoreEntry(entry)).filter((entry): entry is ScoreEntry => entry !== null))
    } catch {
      return []
    }
  }
}

export class PostgresScoreStore implements ScoreStore {
  private readonly pool: PgPool

  constructor(pool: PgPool) {
    this.pool = pool
  }

  async top(limit: number): Promise<ScoreEntry[]> {
    const result = await this.pool.query(
      'select name, score, shifts, client_at, created_at from scores order by score desc, shifts desc, created_at asc limit $1',
      [limit],
    )
    return result.rows.map(rowToEntry)
  }

  async submit(entry: ScoreEntry): Promise<ScoreEntry[]> {
    await this.pool.query('insert into scores (name, score, shifts, client_at) values ($1, $2, $3, $4)', [
      entry.name,
      entry.score,
      entry.shifts,
      entry.at,
    ])
    await this.pool.query(`
      delete from scores where id in (
        select id from scores order by score desc, shifts desc, created_at asc offset $1
      )
    `, [MAX_STORED])
    return this.top(10)
  }
}

export function registerScoreRoutes(app: FastifyInstance, scoresFile: string, pool: PgPool | null): void {
  const store: ScoreStore = pool ? new PostgresScoreStore(pool) : new FileScoreStore(scoresFile)

  app.get('/api/scores', async (req) => {
    const limit = normaliseLimit((req.query as { limit?: unknown }).limit)
    return { entries: await store.top(limit) }
  })

  app.post('/api/scores', async (req, reply) => {
    const key = `scores:${ipFrom(req.headers, req.ip)}`
    try {
      if (!(await allowRequestAsync(key, RATE_LIMITS.scoreSubmit))) {
        reply.code(429)
        return { entries: await store.top(10), accepted: false }
      }
    } catch {
      reply.code(503)
      return { entries: await store.top(10), accepted: false }
    }
    const entry = normaliseScoreEntry(req.body)
    if (!entry) {
      reply.code(400)
      return { entries: await store.top(10), accepted: false }
    }
    const entries = await store.submit(entry)
    return { entries: entries.slice(0, 10), accepted: true }
  })
}
