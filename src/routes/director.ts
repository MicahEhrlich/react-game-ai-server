import type { IncomingMessage, ServerResponse } from 'node:http'
import { makeDirectorHandler } from '../../server/directorEndpoint.ts'
import { quiet, rateLimit, RATE_LIMITS } from '../rateLimit.ts'
import { runConnectHandler } from '../nodeHandler.ts'

function directorKind(body: unknown): 'plan' | 'epitaph' {
  return typeof body === 'object' && body !== null && (body as { kind?: unknown }).kind === 'epitaph'
    ? 'epitaph'
    : 'plan'
}

type DirectorHandler = ReturnType<typeof makeDirectorHandler>

export function directorRoute(apiKey: string | undefined, handler: DirectorHandler = makeDirectorHandler(apiKey)) {
  return async (req: IncomingMessage, res: ServerResponse, body?: unknown): Promise<void> => {
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
    if (!(await rateLimit(req, res, `director:${kind}`, rule, true))) return
    runConnectHandler(handler, req, res, body)
  }
}
