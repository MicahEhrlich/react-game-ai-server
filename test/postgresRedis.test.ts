import test from 'node:test'
import assert from 'node:assert/strict'
import { allowRequestAsync, resetRateLimitsForTests, setRedisRateLimitClient } from '../src/rateLimit.ts'
import { PostgresScoreStore } from '../src/routes/scores.ts'

class FakeRedis {
  counts = new Map<string, number>()
  expires: string[] = []

  async incr(key: string): Promise<number> {
    const next = (this.counts.get(key) ?? 0) + 1
    this.counts.set(key, next)
    return next
  }

  async pExpire(key: string): Promise<number> {
    this.expires.push(key)
    return 1
  }
}

class FakePool {
  rows: { id: string; name: string; score: number; shifts: number; client_at: number; created_at: Date }[] = []

  async query(sql: string, params: unknown[] = []): Promise<{ rows: unknown[] }> {
    if (sql.includes('insert into scores')) {
      this.rows.push({
        id: String(this.rows.length + 1),
        name: String(params[0]),
        score: Number(params[1]),
        shifts: Number(params[2]),
        client_at: Number(params[3]),
        created_at: new Date(1000 + this.rows.length),
      })
      return { rows: [] }
    }
    if (sql.includes('delete from scores')) {
      this.rows = [...this.rows]
        .sort((a, b) => b.score - a.score || b.shifts - a.shifts || a.created_at.getTime() - b.created_at.getTime())
        .slice(0, Number(params[0]))
      return { rows: [] }
    }
    if (sql.includes('select name')) {
      return {
        rows: [...this.rows]
          .sort((a, b) => b.score - a.score || b.shifts - a.shifts || a.created_at.getTime() - b.created_at.getTime())
          .slice(0, Number(params[0])),
      }
    }
    return { rows: [] }
  }
}

test('redis-backed rate limiter blocks after max', async () => {
  resetRateLimitsForTests()
  const redis = new FakeRedis()
  setRedisRateLimitClient(redis as never)
  const rule = { windowMs: 1000, max: 2 }
  assert.equal(await allowRequestAsync('redis-key', rule), true)
  assert.equal(await allowRequestAsync('redis-key', rule), true)
  assert.equal(await allowRequestAsync('redis-key', rule), false)
  assert.deepEqual(redis.expires, ['rl:redis-key'])
})

test('PostgresScoreStore inserts and reads sorted scores', async () => {
  const pool = new FakePool()
  const store = new PostgresScoreStore(pool as never)
  await store.submit({ name: 'AAA', score: 10, shifts: 1, at: 1 })
  await store.submit({ name: 'BBB', score: 50, shifts: 3, at: 2 })
  assert.deepEqual(await store.top(1), [{ name: 'BBB', score: 50, shifts: 3, at: 2 }])
})
