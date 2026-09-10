import assert from 'node:assert/strict'
import test from 'node:test'
import { createClient } from 'redis'
import { loadConfig } from '../../src/config.ts'
import { buildServer } from '../../src/server.ts'

const allowedOrigin = 'https://ci.example'
const disallowedOrigin = 'https://not-ci.example'

test('server works with PostgreSQL and Redis over HTTP', async (t) => {
  assert.ok(process.env.DATABASE_URL, 'DATABASE_URL is required for integration tests')
  const redisUrl = process.env.REDIS_URL
  assert.ok(redisUrl, 'REDIS_URL is required for integration tests')

  const redisAdmin = createClient({ url: redisUrl })
  redisAdmin.on('error', (error) => t.diagnostic(`Redis client error: ${error.message}`))
  await redisAdmin.connect()
  await redisAdmin.flushDb()
  t.after(async () => {
    await redisAdmin.quit()
  })

  const config = loadConfig({
    ...process.env,
    ANTHROPIC_API_KEY: '',
    CORS_ORIGINS: allowedOrigin,
    HOST: '127.0.0.1',
    NODE_ENV: 'test',
  })
  const app = await buildServer(config)
  await app.listen({ host: config.host, port: 0 })
  t.after(async () => {
    await app.close()
  })

  const address = app.server.address()
  assert.ok(address && typeof address !== 'string', 'Fastify did not expose a TCP address')
  const baseUrl = `http://127.0.0.1:${address.port}`

  const health = await fetch(`${baseUrl}/health`)
  assert.equal(health.status, 200)
  assert.deepEqual(await health.json(), { ok: true })

  const allowedCors = await fetch(`${baseUrl}/health`, {
    headers: { origin: allowedOrigin },
  })
  assert.equal(allowedCors.headers.get('access-control-allow-origin'), allowedOrigin)

  const disallowedCors = await fetch(`${baseUrl}/health`, {
    headers: { origin: disallowedOrigin },
  })
  assert.equal(disallowedCors.headers.get('access-control-allow-origin'), null)

  const submittedAt = Date.now()
  const submitted = await fetch(`${baseUrl}/api/scores`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': '192.0.2.10',
    },
    body: JSON.stringify({ name: 'CI TEST', score: 987654, shifts: 7, at: submittedAt }),
  })
  assert.equal(submitted.status, 200)
  const submittedBody = await submitted.json() as { accepted: boolean }
  assert.equal(submittedBody.accepted, true)

  const scores = await fetch(`${baseUrl}/api/scores?limit=100`)
  assert.equal(scores.status, 200)
  const scoresBody = await scores.json() as {
    entries: { name: string; score: number; shifts: number; at: number }[]
  }
  assert.ok(scoresBody.entries.some((entry) => (
    entry.name === 'CI TEST'
    && entry.score === 987654
    && entry.shifts === 7
    && entry.at === submittedAt
  )))

  for (let request = 1; request <= 21; request += 1) {
    const response = await fetch(`${baseUrl}/api/scores`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': '192.0.2.20',
      },
      body: JSON.stringify({ name: `RATE ${request}`, score: request, shifts: 0 }),
    })
    assert.equal(response.status, request <= 20 ? 200 : 429)
    const body = await response.json() as { accepted: boolean }
    assert.equal(body.accepted, request <= 20)
  }

  assert.equal(await redisAdmin.get('rl:scores:192.0.2.20'), '21')
})
