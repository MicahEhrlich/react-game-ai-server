import type { IncomingMessage, ServerResponse } from 'node:http'
import type { RedisClient } from './db.ts'
import { recordDependencyFailure, recordRateLimit } from './observability.ts'

export interface RateLimitRule {
  readonly windowMs: number
  readonly max: number
}

interface Bucket {
  resetAt: number
  count: number
}

const buckets = new Map<string, Bucket>()
let redis: RedisClient | null = null

export const RATE_LIMITS = {
  directorPlan: { windowMs: 10 * 60_000, max: 30 },
  directorEpitaph: { windowMs: 10 * 60_000, max: 10 },
  memeTheme: { windowMs: 24 * 60 * 60_000, max: 10 },
  scoreSubmit: { windowMs: 10 * 60_000, max: 20 },
} satisfies Record<string, RateLimitRule>

function ipFrom(req: IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.trim()) return forwarded.split(',')[0]?.trim() ?? 'unknown'
  return req.socket.remoteAddress ?? 'unknown'
}

export function setRedisRateLimitClient(client: RedisClient | null): void {
  redis = client
}

export function quiet(res: ServerResponse): void {
  res.statusCode = 204
  res.end()
}

export function allowRequest(key: string, rule: RateLimitRule, now = Date.now()): boolean {
  const current = buckets.get(key)
  if (!current || current.resetAt <= now) {
    buckets.set(key, { resetAt: now + rule.windowMs, count: 1 })
    return true
  }
  if (current.count >= rule.max) return false
  current.count++
  return true
}

export async function allowRequestAsync(key: string, rule: RateLimitRule, route = 'unknown'): Promise<boolean> {
  if (!redis) {
    const allowed = allowRequest(key, rule)
    recordRateLimit(route, 'memory', allowed ? 'allowed' : 'limited')
    return allowed
  }
  const redisKey = `rl:${key}`
  try {
    const count = await redis.incr(redisKey)
    if (count === 1) await redis.pExpire(redisKey, rule.windowMs)
    const allowed = count <= rule.max
    recordRateLimit(route, 'redis', allowed ? 'allowed' : 'limited')
    return allowed
  } catch (error) {
    recordRateLimit(route, 'redis', 'error')
    recordDependencyFailure('redis', 'rate_limit', error)
    throw error
  }
}

export async function rateLimit(
  req: IncomingMessage,
  res: ServerResponse,
  route: string,
  rule: RateLimitRule,
  failClosed = false,
): Promise<boolean> {
  const session = typeof req.headers['x-run-id'] === 'string' ? req.headers['x-run-id'] : ''
  const key = `${route}:${ipFrom(req)}:${session}`
  try {
    if (await allowRequestAsync(key, rule, route)) return true
  } catch (err) {
    console.info(`[rate-limit] ${err instanceof Error ? err.message : 'unknown error'}`)
    if (!failClosed) return true
  }
  quiet(res)
  return false
}

export function resetRateLimitsForTests(): void {
  buckets.clear()
  redis = null
}
