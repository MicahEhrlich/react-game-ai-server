import type { IncomingMessage, ServerResponse } from 'node:http'
import { makeMemeThemeHandler } from '../../server/memeThemeEndpoint.ts'
import { quiet, rateLimit, RATE_LIMITS } from '../rateLimit.ts'
import { runConnectHandler } from '../nodeHandler.ts'
import { recordAiOutcome } from '../observability.ts'

function isAdultBody(body: unknown): boolean {
  return typeof body === 'object' && body !== null && (body as { adultMode?: unknown }).adultMode === true
}

type MemeThemeHandler = ReturnType<typeof makeMemeThemeHandler>

export function memeThemeRoute(apiKey: string | undefined, handler?: MemeThemeHandler) {
  const actualHandler = handler ?? makeMemeThemeHandler(apiKey, (outcome, durationMs) => {
    recordAiOutcome('meme-theme', 'theme', outcome, durationMs)
  })
  return async (req: IncomingMessage, res: ServerResponse, body?: unknown): Promise<void> => {
    if (req.method !== 'GET' && req.method !== 'POST') {
      res.statusCode = 404
      res.end()
      return
    }
    if (req.method === 'POST' && isAdultBody(body)) {
      recordAiOutcome('meme-theme', 'theme', 'unsupported_mode', 0)
      quiet(res)
      return
    }
    if (!apiKey) {
      recordAiOutcome('meme-theme', 'theme', 'disabled', 0)
      quiet(res)
      return
    }
    if (!(await rateLimit(req, res, 'meme-theme', RATE_LIMITS.memeTheme, true))) {
      recordAiOutcome('meme-theme', 'theme', 'rate_limited', 0)
      return
    }
    runConnectHandler(actualHandler, req, res, body)
  }
}
