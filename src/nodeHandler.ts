import { Readable } from 'node:stream'
import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'node:http'
import type { Connect } from 'vite'

type ConnectHandler = (
  req: Connect.IncomingMessage,
  res: ServerResponse,
  next: Connect.NextFunction,
) => void

function bodyText(body: unknown): string {
  if (body === undefined || body === null) return ''
  if (typeof body === 'string') return body
  if (Buffer.isBuffer(body)) return body.toString('utf8')
  return JSON.stringify(body)
}

function replayRequest(raw: IncomingMessage, body: unknown): Connect.IncomingMessage {
  const replay = Readable.from(bodyText(body)) as Connect.IncomingMessage
  replay.method = raw.method
  replay.url = raw.url
  replay.headers = raw.headers as IncomingHttpHeaders
  replay.socket = raw.socket
  replay.destroy = raw.destroy.bind(raw) as IncomingMessage['destroy']
  return replay
}

export function runConnectHandler(
  handler: ConnectHandler,
  req: IncomingMessage,
  res: ServerResponse,
  body?: unknown,
): void {
  handler(replayRequest(req, body), res, () => {
    if (!res.headersSent && !res.writableEnded) {
      res.statusCode = 404
      res.end()
    }
  })
}
