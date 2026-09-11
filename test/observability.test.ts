import assert from 'node:assert/strict'
import test from 'node:test'
import { scrubSentryEvent } from '../src/instrument.ts'

test('Sentry event scrubbing removes identifying and gameplay data', () => {
  const event = scrubSentryEvent({
    user: { id: 'player' },
    request: {
      url: 'https://api.example/api/scores?name=PLAYER',
      query_string: 'name=PLAYER',
      data: { name: 'PLAYER', score: 1 },
      cookies: { session: 'secret' },
      headers: { authorization: 'secret', cookie: 'secret', accept: 'application/json' },
    },
    contexts: { gameplay: { score: 1 } },
  })
  assert.equal(event.user, undefined)
  assert.equal(event.request?.url, 'https://api.example/api/scores')
  assert.equal(event.request?.data, undefined)
  assert.equal(event.request?.query_string, undefined)
  assert.equal(event.request?.headers?.authorization, undefined)
  assert.equal(event.contexts?.gameplay, undefined)
})
