import Fastify from 'fastify'
import cors from '@fastify/cors'
import { createPgPool, createRedis } from './db.ts'
import { isAllowedOrigin, loadConfig } from './config.ts'
import { setRedisRateLimitClient } from './rateLimit.ts'
import { directorRoute } from './routes/director.ts'
import { memeThemeRoute } from './routes/memeTheme.ts'
import { registerScoreRoutes } from './routes/scores.ts'
import { hijackWithHeaders } from './nodeHandler.ts'

export async function buildServer(config = loadConfig()) {
  const pool = createPgPool(config.databaseUrl)
  const redis = await createRedis(config.redisUrl)
  setRedisRateLimitClient(redis)

  const app = Fastify({ logger: true, bodyLimit: 64 * 1024 })
  if (!config.anthropicApiKey) {
    app.log.warn('ANTHROPIC_API_KEY is missing; AI routes return 204 and the game uses local fallbacks. Set it in .env.local or the server environment.')
  }

  app.addHook('onClose', async () => {
    setRedisRateLimitClient(null)
    await redis?.quit()
    await pool?.end()
  })

  await app.register(cors, {
    origin(origin, cb) {
      if (isAllowedOrigin(origin, config.allowedOrigins)) cb(null, true)
      else cb(null, false)
    },
  })

  const director = directorRoute(config.anthropicApiKey)
  const memeTheme = memeThemeRoute(config.anthropicApiKey)

  app.get('/health', async () => ({ ok: true }))
  registerScoreRoutes(app, config.scoresFile, pool)
  app.all('/api/director', (req, reply) => {
    hijackWithHeaders(reply)
    void director(req.raw, reply.raw, req.body)
  })
  app.all('/api/meme-theme', (req, reply) => {
    hijackWithHeaders(reply)
    void memeTheme(req.raw, reply.raw, req.body)
  })

  return app
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const config = loadConfig()
  const app = await buildServer(config)
  await app.listen({ host: config.host, port: config.port })
}
