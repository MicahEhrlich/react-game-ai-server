import type { IncomingMessage, ServerResponse } from 'node:http'

export interface RateLimitRule {
  readonly windowMs: number
  readonly max: number
}

interface Bucket {
  resetAt: number
  count: number
}

const buckets = new Map<string, Bucket>()

export const RATE_LIMITS = {
  directorPlan: { windowMs: 10 * 60_000, max: 30 },
  directorEpitaph: { windowMs: 10 * 60_000, max: 10 },
  memeTheme: { windowMs: 24 * 60 * 60_000, max: 10 },
} satisfies Record<string, RateLimitRule>

function ipFrom(req: IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.trim()) return forwarded.split(',')[0]?.trim() ?? 'unknown'
  return req.socket.remoteAddress ?? 'unknown'
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

export function rateLimit(req: IncomingMessage, res: ServerResponse, route: string, rule: RateLimitRule): boolean {
  const session = typeof req.headers['x-run-id'] === 'string' ? req.headers['x-run-id'] : ''
  const key = `${route}:${ipFrom(req)}:${session}`
  if (allowRequest(key, rule)) return true
  quiet(res)
  return false
}

export function resetRateLimitsForTests(): void {
  buckets.clear()
}
