import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import type { Connect } from 'vite'
import type { ServerResponse } from 'node:http'
import { buildServer } from '../src/server.ts'
import { directorRoute } from '../src/routes/director.ts'
import { memeThemeRoute } from '../src/routes/memeTheme.ts'
import { registerScoreRoutes } from '../src/routes/scores.ts'
import { RATE_LIMITS, resetRateLimitsForTests } from '../src/rateLimit.ts'
import { runConnectHandler } from '../src/nodeHandler.ts'

function jsonHandler(body: unknown): Connect.NextHandleFunction {
  return (_req: Connect.IncomingMessage, res: ServerResponse) => {
    res.statusCode = 200
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify(body))
  }
}

function quietHandler(): Connect.NextHandleFunction {
  return (_req: Connect.IncomingMessage, res: ServerResponse) => {
    res.statusCode = 204
    res.end()
  }
}

test('Connect handler adapter replays parsed Fastify bodies as Buffer chunks', async () => {
  const app = Fastify()
  app.post('/replay', (req, reply) => {
    reply.hijack()
    runConnectHandler(
      (replayed, res) => {
        const chunks: Buffer[] = []
        replayed.on('data', (chunk: Buffer) => chunks.push(chunk))
        replayed.on('end', () => {
          res.statusCode = 200
          res.setHeader('content-type', 'application/json')
          res.end(Buffer.concat(chunks))
        })
      },
      req.raw,
      reply.raw,
      req.body,
    )
  })

  const response = await app.inject({ method: 'POST', url: '/replay', payload: { kind: 'plan' } })
  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.json(), { kind: 'plan' })
  await app.close()
})

test('health route returns ok', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'server-health-'))
  const app = await buildServer({
    host: '127.0.0.1',
    port: 0,
    allowedOrigins: [],
    scoresFile: join(dir, 'scores.json'),
    nodeEnv: 'test',
  })
  const res = await app.inject({ method: 'GET', url: '/health' })
  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.json(), { ok: true })
  await app.close()
})

test('score routes reject malformed payloads and rate-limit submissions', async () => {
  resetRateLimitsForTests()
  const dir = await mkdtemp(join(tmpdir(), 'score-api-rate-limit-'))
  const app = Fastify()
  registerScoreRoutes(app, join(dir, 'scores.json'), null)

  const bad = await app.inject({ method: 'POST', url: '/api/scores', payload: { name: '<x>', score: 1, shifts: 1 } })
  assert.equal(bad.statusCode, 400)
  assert.equal(bad.json().accepted, false)

  resetRateLimitsForTests()
  const originalMax = RATE_LIMITS.scoreSubmit.max
  RATE_LIMITS.scoreSubmit.max = 1
  try {
    const first = await app.inject({ method: 'POST', url: '/api/scores', payload: { name: 'AAA', score: 1, shifts: 1 } })
    const second = await app.inject({ method: 'POST', url: '/api/scores', payload: { name: 'BBB', score: 2, shifts: 1 } })
    assert.equal(first.statusCode, 200)
    assert.equal(second.statusCode, 429)
    assert.equal(second.json().accepted, false)
  } finally {
    RATE_LIMITS.scoreSubmit.max = originalMax
    resetRateLimitsForTests()
    await app.close()
  }
})

test('director route returns 204 without a key and proxies valid handler JSON with a key', async () => {
  resetRateLimitsForTests()
  const noKey = Fastify()
  noKey.all('/api/director', (req, reply) => {
    reply.hijack()
    void directorRoute(undefined)(req.raw, reply.raw, req.body)
  })
  const missing = await noKey.inject({ method: 'POST', url: '/api/director', payload: { kind: 'plan' } })
  assert.equal(missing.statusCode, 204)
  await noKey.close()

  const withKey = Fastify()
  withKey.all('/api/director', (req, reply) => {
    reply.hijack()
    void directorRoute('test-key', jsonHandler({ ok: true }))(req.raw, reply.raw, req.body)
  })
  const ok = await withKey.inject({ method: 'POST', url: '/api/director', payload: { kind: 'plan' } })
  assert.equal(ok.statusCode, 200)
  assert.deepEqual(ok.json(), { ok: true })
  await withKey.close()
})

test('director route rate-limit hits return quiet 204', async () => {
  resetRateLimitsForTests()
  const originalMax = RATE_LIMITS.directorPlan.max
  RATE_LIMITS.directorPlan.max = 1
  const app = Fastify()
  let calls = 0
  app.all('/api/director', (req, reply) => {
    reply.hijack()
    void directorRoute('test-key', (_raw, res) => {
      calls++
      res.statusCode = 200
      res.setHeader('content-type', 'application/json')
      res.end('{"ok":true}')
    })(req.raw, reply.raw, req.body)
  })
  try {
    assert.equal((await app.inject({ method: 'POST', url: '/api/director', payload: { kind: 'plan' } })).statusCode, 200)
    assert.equal((await app.inject({ method: 'POST', url: '/api/director', payload: { kind: 'plan' } })).statusCode, 204)
    assert.equal(calls, 1)
  } finally {
    RATE_LIMITS.directorPlan.max = originalMax
    resetRateLimitsForTests()
    await app.close()
  }
})

test('meme theme route skips adult mode and proxies safe handler JSON', async () => {
  resetRateLimitsForTests()
  const app = Fastify()
  let calls = 0
  app.all('/api/meme-theme', (req, reply) => {
    reply.hijack()
    void memeThemeRoute('test-key', (_raw, res) => {
      calls++
      res.statusCode = 200
      res.setHeader('content-type', 'application/json')
      res.end('{"ok":true}')
    })(req.raw, reply.raw, req.body)
  })

  const adult = await app.inject({ method: 'POST', url: '/api/meme-theme', payload: { adultMode: true } })
  assert.equal(adult.statusCode, 204)
  assert.equal(calls, 0)

  const safe = await app.inject({ method: 'POST', url: '/api/meme-theme', payload: { date: '2026-09-03' } })
  assert.equal(safe.statusCode, 200)
  assert.deepEqual(safe.json(), { ok: true })
  assert.equal(calls, 1)
  await app.close()
})

test('meme theme handler failures keep the 204 fallback contract', async () => {
  resetRateLimitsForTests()
  const app = Fastify()
  app.all('/api/meme-theme', (req, reply) => {
    reply.hijack()
    void memeThemeRoute('test-key', quietHandler())(req.raw, reply.raw, req.body)
  })
  const res = await app.inject({ method: 'GET', url: '/api/meme-theme' })
  assert.equal(res.statusCode, 204)
  await app.close()
})
