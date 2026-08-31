import Fastify from 'fastify'
import cors from '@fastify/cors'
import { loadConfig } from './config.ts'
import { directorRoute } from './routes/director.ts'
import { memeThemeRoute } from './routes/memeTheme.ts'
import { registerScoreRoutes } from './routes/scores.ts'

export async function buildServer(config = loadConfig()) {
  const app = Fastify({ logger: true, bodyLimit: 64 * 1024 })

  await app.register(cors, {
    origin(origin, cb) {
      if (!origin || config.allowedOrigins.includes(origin)) cb(null, true)
      else cb(null, false)
    },
  })

  const director = directorRoute(config.anthropicApiKey)
  const memeTheme = memeThemeRoute(config.anthropicApiKey)

  app.get('/health', async () => ({ ok: true }))
  registerScoreRoutes(app, config.scoresFile)
  app.all('/api/director', (req, reply) => {
    reply.hijack()
    director(req.raw, reply.raw, req.body)
  })
  app.all('/api/meme-theme', (req, reply) => {
    reply.hijack()
    memeTheme(req.raw, reply.raw, req.body)
  })

  return app
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const config = loadConfig()
  const app = await buildServer(config)
  await app.listen({ host: config.host, port: config.port })
}
