import Fastify, { LogController } from 'fastify'
import { randomUUID } from 'node:crypto'
import cors from '@fastify/cors'
import { createPgPool, createRedis } from './db.ts'
import type { PgPool, RedisClient } from './db.ts'
import { isAllowedOrigin, loadConfig } from './config.ts'
import { setRedisRateLimitClient } from './rateLimit.ts'
import { directorRoute } from './routes/director.ts'
import { memeThemeRoute } from './routes/memeTheme.ts'
import { registerScoreRoutes } from './routes/scores.ts'
import { hijackWithHeaders } from './nodeHandler.ts'
import { recordDependencyFailure, Sentry } from './observability.ts'

const PROBE_TIMEOUT_MS = 2_000

async function boundedProbe(operation: () => Promise<unknown>): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined
  try {
    await Promise.race([
      operation(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('probe timed out')), PROBE_TIMEOUT_MS)
      }),
    ])
    return true
  } catch {
    return false
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export interface ServerDependencies {
  readonly pool?: PgPool | null
  readonly redis?: RedisClient | null
}

export async function buildServer(config = loadConfig(), dependencies: ServerDependencies = {}) {
  const pool = dependencies.pool !== undefined ? dependencies.pool : createPgPool(config.databaseUrl)
  const redis = dependencies.redis !== undefined ? dependencies.redis : await createRedis(config.redisUrl)
  setRedisRateLimitClient(redis)

  const app = Fastify({
    logger: true,
    logController: new LogController({ disableRequestLogging: true }),
    bodyLimit: 64 * 1024,
    genReqId: () => randomUUID(),
  })
  if (!config.anthropicApiKey) {
    app.log.warn('ANTHROPIC_API_KEY is missing; AI routes return 204 and the game uses local fallbacks. Set it in .env.local or the server environment.')
  }

  app.addHook('onClose', async () => {
    setRedisRateLimitClient(null)
    await redis?.quit()
    await pool?.end()
  })

  app.addHook('onRequest', async (req, reply) => {
    const started = performance.now()
    reply.header('x-request-id', req.id)
    Sentry.getIsolationScope().setTag('request_id', req.id)
    reply.raw.once('finish', () => {
      const route = req.routeOptions.url || 'unmatched'
      const status = reply.raw.statusCode
      const durationMs = performance.now() - started
      app.log.info({ requestId: req.id, method: req.method, route, status, durationMs }, 'request completed')
      Sentry.metrics.count('http.requests', 1, {
        attributes: { method: req.method, route, status_class: `${Math.floor(status / 100)}xx` },
      })
      Sentry.metrics.distribution('http.duration', durationMs, {
        unit: 'millisecond',
        attributes: { method: req.method, route, status_class: `${Math.floor(status / 100)}xx` },
      })
    })
  })

  await app.register(cors, {
    exposedHeaders: ['x-request-id'],
    origin(origin, cb) {
      if (isAllowedOrigin(origin, config.allowedOrigins)) cb(null, true)
      else cb(null, false)
    },
  })

  const director = directorRoute(config.anthropicApiKey)
  const memeTheme = memeThemeRoute(config.anthropicApiKey)

  const release = config.release ?? 'development'
  app.get('/health', async () => ({ ok: true, release }))
  app.get('/health/ready', async (_req, reply) => {
    const postgresOk = pool ? await boundedProbe(() => pool.query('select 1')) : true
    const redisOk = redis ? await boundedProbe(() => redis.ping()) : false
    if (!postgresOk) {
      recordDependencyFailure('postgres', 'readiness', new Error('PostgreSQL readiness probe failed'))
      reply.code(503)
    }
    if (!redisOk && config.redisUrl) {
      recordDependencyFailure('redis', 'readiness', new Error('Redis readiness probe failed'))
    }
    return {
      ready: postgresOk,
      status: postgresOk && redisOk ? 'ok' : postgresOk ? 'degraded' : 'unavailable',
      release,
      dependencies: {
        postgres: postgresOk ? 'ok' : 'unavailable',
        redis: redisOk ? 'ok' : 'degraded',
      },
    }
  })
  registerScoreRoutes(app, config.scoresFile, pool)
  app.all('/api/director', (req, reply) => {
    hijackWithHeaders(reply)
    void director(req.raw, reply.raw, req.body)
  })
  app.all('/api/meme-theme', (req, reply) => {
    hijackWithHeaders(reply)
    void memeTheme(req.raw, reply.raw, req.body)
  })

  Sentry.setupFastifyErrorHandler(app)

  return app
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const config = loadConfig()
  const app = await buildServer(config)
  await app.listen({ host: config.host, port: config.port })
}
