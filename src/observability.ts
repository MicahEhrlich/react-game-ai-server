import * as Sentry from '@sentry/node'

export type AiOutcome =
  | 'success'
  | 'disabled'
  | 'rate_limited'
  | 'upstream_timeout'
  | 'upstream_error'
  | 'refused'
  | 'invalid_response'
  | 'unsupported_mode'

export type RateLimitBackend = 'redis' | 'memory'

export function recordAiOutcome(route: string, kind: string, outcome: AiOutcome, durationMs: number): void {
  const attributes = { route, kind, outcome }
  Sentry.metrics.count('ai.requests', 1, { attributes })
  Sentry.metrics.distribution('ai.duration', durationMs, { unit: 'millisecond', attributes })
}

export function recordRateLimit(route: string, backend: RateLimitBackend, outcome: 'allowed' | 'limited' | 'error'): void {
  Sentry.metrics.count('rate_limit.requests', 1, { attributes: { route, backend, outcome } })
}

export function recordDependencyFailure(dependency: 'postgres' | 'redis', operation: string, error: unknown): void {
  Sentry.metrics.count('dependency.failures', 1, { attributes: { dependency, operation } })
  Sentry.captureException(error instanceof Error ? error : new Error(`${dependency} ${operation} failed`), {
    tags: { dependency, operation },
  })
}

export { Sentry }
