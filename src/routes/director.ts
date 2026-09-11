import type { IncomingMessage, ServerResponse } from 'node:http'
import { makeDirectorHandler } from '../../server/directorEndpoint.ts'
import { quiet, rateLimit, RATE_LIMITS } from '../rateLimit.ts'
import { runConnectHandler } from '../nodeHandler.ts'
import { recordAiOutcome } from '../observability.ts'

function directorKind(body: unknown): 'plan' | 'epitaph' {
  return typeof body === 'object' && body !== null && (body as { kind?: unknown }).kind === 'epitaph'
    ? 'epitaph'
    : 'plan'
}

type DirectorHandler = ReturnType<typeof makeDirectorHandler>

export function directorRoute(apiKey: string | undefined, handler?: DirectorHandler) {
  const actualHandler = handler ?? makeDirectorHandler(apiKey, (outcome, kind, durationMs) => {
    recordAiOutcome('director', kind, outcome, durationMs)
  })
  return async (req: IncomingMessage, res: ServerResponse, body?: unknown): Promise<void> => {
    if (req.method !== 'POST') {
      res.statusCode = 404
      res.end()
      return
    }
    if (!apiKey) {
      recordAiOutcome('director', directorKind(body), 'disabled', 0)
      quiet(res)
      return
    }
    const kind = directorKind(body)
    const rule = kind === 'epitaph' ? RATE_LIMITS.directorEpitaph : RATE_LIMITS.directorPlan
    if (!(await rateLimit(req, res, `director:${kind}`, rule, true))) {
      recordAiOutcome('director', kind, 'rate_limited', 0)
      return
    }
    runConnectHandler(actualHandler, req, res, body)
  }
}
