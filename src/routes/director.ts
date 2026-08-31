import type { IncomingMessage, ServerResponse } from 'node:http'
import { makeDirectorHandler } from '../../../react-game-ai/server/directorEndpoint.ts'
import { quiet, rateLimit, RATE_LIMITS } from '../rateLimit.ts'
import { runConnectHandler } from '../nodeHandler.ts'

function directorKind(body: unknown): 'plan' | 'epitaph' {
  return typeof body === 'object' && body !== null && (body as { kind?: unknown }).kind === 'epitaph'
    ? 'epitaph'
    : 'plan'
}

export function directorRoute(apiKey: string | undefined) {
  const handler = makeDirectorHandler(apiKey)
  return (req: IncomingMessage, res: ServerResponse, body?: unknown): void => {
    if (req.method !== 'POST') {
      res.statusCode = 404
      res.end()
      return
    }
    if (!apiKey) {
      quiet(res)
      return
    }
    const kind = directorKind(body)
    const rule = kind === 'epitaph' ? RATE_LIMITS.directorEpitaph : RATE_LIMITS.directorPlan
    if (!rateLimit(req, res, `director:${kind}`, rule)) return
    runConnectHandler(handler, req, res, body)
  }
}
