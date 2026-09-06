import test from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import { buildServer } from '../src/server.ts'
import { hijackWithHeaders } from '../src/nodeHandler.ts'

const origin = 'https://game.example'

test('raw JSON responses retain CORS headers and body', async () => {
  const app = Fastify()
  await app.register(cors, { origin: (requestOrigin, cb) => cb(null, requestOrigin === origin) })
  app.post('/api/director', (_req, reply) => {
    reply.header('x-test-hook', 'preserved')
    hijackWithHeaders(reply)
    reply.raw.setHeader('content-type', 'application/json')
    reply.raw.end(JSON.stringify({ mode: 'runner', notes: ['ADAPTING'] }))
  })
  try {
    const response = await app.inject({ method: 'POST', url: '/api/director', headers: { origin }, payload: {} })
    assert.equal(response.statusCode, 200)
    assert.equal(response.headers['access-control-allow-origin'], origin)
    assert.match(String(response.headers.vary), /Origin/i)
    assert.equal(response.headers['x-test-hook'], 'preserved')
    assert.deepEqual(response.json(), { mode: 'runner', notes: ['ADAPTING'] })
  } finally { await app.close() }
})

test('both AI routes retain CORS for allowed origins, including preflight and fallback', async () => {
  const app = await buildServer({ host: '127.0.0.1', port: 8787, allowedOrigins: [origin], scoresFile: '/private/tmp/cors-test-unused.json', nodeEnv: 'test' })
  try {
    for (const url of ['/api/director', '/api/meme-theme']) {
      const preflight = await app.inject({ method: 'OPTIONS', url, headers: { origin, 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type' } })
      assert.equal(preflight.statusCode, 204)
      assert.equal(preflight.headers['access-control-allow-origin'], origin)
      const response = await app.inject({ method: 'POST', url, headers: { origin }, payload: { kind: 'plan' } })
      assert.equal(response.statusCode, 204)
      assert.equal(response.headers['access-control-allow-origin'], origin)
      assert.match(String(response.headers.vary), /Origin/i)
      const denied = await app.inject({ method: 'POST', url, headers: { origin: 'https://unapproved.example' }, payload: {} })
      assert.equal(denied.headers['access-control-allow-origin'], undefined)
      const sameOrigin = await app.inject({ method: 'POST', url, payload: {} })
      assert.equal(sameOrigin.statusCode, 204)
    }
  } finally { await app.close() }
})
