import type { IncomingMessage, ServerResponse } from 'node:http'
import { makeMemeThemeHandler } from '../../server/memeThemeEndpoint.ts'
import { quiet, rateLimit, RATE_LIMITS } from '../rateLimit.ts'
import { runConnectHandler } from '../nodeHandler.ts'

function isAdultBody(body: unknown): boolean {
  return typeof body === 'object' && body !== null && (body as { adultMode?: unknown }).adultMode === true
}

export function memeThemeRoute(apiKey: string | undefined) {
  const handler = makeMemeThemeHandler(apiKey)
  return async (req: IncomingMessage, res: ServerResponse, body?: unknown): Promise<void> => {
    if (req.method !== 'GET' && req.method !== 'POST') {
      res.statusCode = 404
      res.end()
      return
    }
    if (req.method === 'POST' && isAdultBody(body)) {
      quiet(res)
      return
    }
    if (!apiKey) {
      quiet(res)
      return
    }
    if (!(await rateLimit(req, res, 'meme-theme', RATE_LIMITS.memeTheme, true))) return
    runConnectHandler(handler, req, res, body)
  }
}
