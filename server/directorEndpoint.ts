import type { Connect, Plugin, PreviewServer, ViteDevServer } from 'vite'
import { loadEnv } from 'vite'
import type { DirectorRequest } from '../src/director/LlmDirector.ts'
import {
  buildEpitaphPayload,
  buildPlanPayload,
  EPITAPH_FORMAT,
  EPITAPH_SYSTEM,
  PLAN_FORMAT,
  SYSTEM,
} from './directorPrompt.ts'

/**
 * The dev-and-preview-only /api/director endpoint.
 *
 * The API key cannot live in the browser, so the model call happens here. This
 * is a Vite middleware rather than a separate Express process on purpose:
 * `npm run dev` stays one command, with no second terminal, no proxy and no
 * CORS. `apply: 'serve'` keeps it out of every build, so `npm run build`
 * produces a static bundle with no endpoint at all -- and the game plays
 * exactly as it did before this feature existed.
 *
 * The contract with the client is deliberately lopsided: 200 + JSON means "a
 * plan", and EVERY other outcome -- no key, a refusal, a timeout, a 500 from
 * upstream -- is 204, meaning "nothing to say". The client treats that as the
 * heuristic taking over, which is the normal path rather than an error path.
 * That is why nothing here returns a 5xx.
 *
 * A real deployment would put this same handler behind a serverless function
 * with the key as a platform secret, and would additionally need per-IP and
 * per-run rate limiting plus a hard spend cap: an unauthenticated model proxy
 * is a bill-drain vector.
 */

const MODEL = 'claude-sonnet-5'
const MAX_BODY_BYTES = 64 * 1024

type Handler = (
  req: Connect.IncomingMessage,
  res: import('node:http').ServerResponse,
  next: Connect.NextFunction,
) => void

function readBody(req: Connect.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => {
      size += c.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error('body too large'))
        req.destroy()
        return
      }
      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function isDirectorRequest(v: unknown): v is DirectorRequest {
  if (typeof v !== 'object' || v === null) return false
  const kind = (v as { kind?: unknown }).kind
  return kind === 'plan' || kind === 'epitaph'
}

export function makeDirectorHandler(apiKey: string | undefined): Handler {
  let warned = false

  return (req, res, next) => {
    if (req.method !== 'POST') {
      next()
      return
    }

    void (async () => {
      // 204 with no body: the client reads this as "the heuristic decides".
      const quiet = (): void => {
        res.statusCode = 204
        res.end()
      }

      if (!apiKey) {
        if (!warned) {
          warned = true
          console.info(
            '[director] no ANTHROPIC_API_KEY -- the heuristic director is in charge. ' +
              'Add one to .env.local to enable the live director.',
          )
        }
        quiet()
        return
      }

      let payload: unknown
      try {
        payload = JSON.parse(await readBody(req))
      } catch {
        res.statusCode = 400
        res.end()
        return
      }

      if (!isDirectorRequest(payload)) {
        res.statusCode = 400
        res.end()
        return
      }

      const started = Date.now()
      try {
        // Imported lazily so a missing package degrades to 204 instead of
        // breaking `vite dev` on startup.
        const { default: Anthropic } = await import('@anthropic-ai/sdk')
        const client = new Anthropic({ apiKey })

        const isPlan = payload.kind === 'plan'
        // Narrowed inside each branch rather than through `isPlan`, which is
        // just a boolean as far as the checker is concerned.
        const system = payload.kind === 'plan' ? SYSTEM : EPITAPH_SYSTEM
        const user =
          payload.kind === 'plan' ? buildPlanPayload(payload) : buildEpitaphPayload(payload)

        const message = await client.messages.create(
          {
            model: MODEL,
            max_tokens: 4096,
            // The single cache breakpoint sits on the frozen system prompt;
            // the user message after it is entirely volatile.
            system: [
              { type: 'text', text: system, cache_control: { type: 'ephemeral' } },
            ],
            messages: [{ role: 'user', content: user }],
            // `effort` and `format` are siblings inside output_config. Low
            // effort suits a small, latency-sensitive task; thinking stays on
            // (adaptive is the default on this model) rather than disabled.
            output_config: {
              effort: 'low',
              format: isPlan ? PLAN_FORMAT : EPITAPH_FORMAT,
            },
          },
          { timeout: isPlan ? 20_000 : 12_000, maxRetries: isPlan ? 2 : 1 },
        )

        const usage = message.usage
        console.info(
          `[director] ${payload.kind} ${Date.now() - started}ms ` +
            `in=${usage.input_tokens} cache_read=${usage.cache_read_input_tokens ?? 0} ` +
            `out=${usage.output_tokens} stop=${message.stop_reason}`,
        )

        // A safety refusal is a legitimate "nothing to say".
        if (message.stop_reason === 'refusal') {
          quiet()
          return
        }

        const text = message.content
          .filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text')
          .map((b) => b.text)
          .join('')

        // Forwarded as-is. Validating it is llmPlan.ts's job, in the browser,
        // where it is needed whether or not this server was involved.
        res.statusCode = 200
        res.setHeader('content-type', 'application/json')
        res.end(text)
      } catch (err) {
        // Never leak the key or a stack into the response.
        console.info(
          `[director] ${payload.kind} failed after ${Date.now() - started}ms: ` +
            (err instanceof Error ? err.message : 'unknown error'),
        )
        quiet()
      }
    })()
  }
}

export function directorApi(mode: string): Plugin {
  // loadEnv with an EMPTY prefix is required: Vite only surfaces VITE_-prefixed
  // variables and never populates process.env from .env files. Without the
  // empty string here, ANTHROPIC_API_KEY in .env.local is silently invisible.
  const env = loadEnv(mode, process.cwd(), '')
  const handler = makeDirectorHandler(env.ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY)

  return {
    name: 'glitch-shift:director-api',
    // Never enters a build: a production bundle has no endpoint, and the
    // client falls back to the heuristic on the resulting 404/405.
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/api/director', handler)
    },
    // Preview is where the production bundle gets validated; without this the
    // director would appear broken there for no reason.
    configurePreviewServer(server: PreviewServer) {
      server.middlewares.use('/api/director', handler)
    },
  }
}
