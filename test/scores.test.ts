import { mkdtemp, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import test from 'node:test'
import assert from 'node:assert/strict'
import { FileScoreStore, normaliseScoreEntry } from '../src/routes/scores.ts'
import { buildServer } from '../src/server.ts'

test('normaliseScoreEntry accepts compact safe scores', () => {
  assert.deepEqual(normaliseScoreEntry({ name: 'abc', score: 10, shifts: 2, at: 5 }, 1), {
    name: 'ABC',
    score: 10,
    shifts: 2,
    at: 5,
  })
})

test('normaliseScoreEntry rejects malformed scores', () => {
  assert.equal(normaliseScoreEntry({ name: '<x>', score: 10, shifts: 2 }), null)
  assert.equal(normaliseScoreEntry({ name: 'OK', score: -1, shifts: 2 }), null)
  assert.equal(normaliseScoreEntry({ name: 'OK', score: 1.5, shifts: 2 }), null)
  assert.equal(normaliseScoreEntry({ name: 'OK', score: 1, shifts: -1 }), null)
})

test('file score store persists sorted top scores', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'scores-'))
  const file = join(dir, 'scores.json')
  const store = new FileScoreStore(file)
  assert.deepEqual(await store.top(10), [])
  await store.submit({ name: 'AAA', score: 20, shifts: 1, at: 2 })
  await store.submit({ name: 'BBB', score: 50, shifts: 1, at: 1 })
  assert.deepEqual(await store.top(1), [{ name: 'BBB', score: 50, shifts: 1, at: 1 }])
  assert.match(await readFile(file, 'utf8'), /BBB/)
})

test('score routes get and post scores', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'score-api-'))
  const app = await buildServer({
    host: '127.0.0.1',
    port: 0,
    allowedOrigins: [],
    scoresFile: join(dir, 'scores.json'),
    nodeEnv: 'test',
  })
  const empty = await app.inject({ method: 'GET', url: '/api/scores?limit=5' })
  assert.equal(empty.statusCode, 200)
  assert.deepEqual(empty.json(), { entries: [] })

  const saved = await app.inject({
    method: 'POST',
    url: '/api/scores',
    payload: { name: 'micah', score: 123, shifts: 4, at: 9 },
  })
  assert.equal(saved.statusCode, 200)
  assert.equal(saved.json().accepted, true)

  const after = await app.inject({ method: 'GET', url: '/api/scores?limit=5' })
  assert.equal(after.json().entries[0].name, 'MICAH')
  await app.close()
})
