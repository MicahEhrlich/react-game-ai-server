import pg from 'pg'
import { createClient } from 'redis'

export type PgPool = pg.Pool
export interface RedisClient {
  incr(key: string): Promise<number>
  pExpire(key: string, milliseconds: number): Promise<number | boolean>
  quit(): Promise<unknown>
}

export function createPgPool(databaseUrl: string | undefined): PgPool | null {
  if (!databaseUrl) return null
  return new pg.Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1') ? false : { rejectUnauthorized: false },
  })
}

export async function createRedis(redisUrl: string | undefined): Promise<RedisClient | null> {
  if (!redisUrl) return null
  const client = createClient({
    url: redisUrl,
    socket: {
      reconnectStrategy: false,
    },
  })
  client.on('error', (err) => console.info(`[redis] ${err instanceof Error ? err.message : 'unknown error'}`))
  let timer: NodeJS.Timeout | null = null
  try {
    await Promise.race([
      client.connect(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('connection timed out')), 3_000)
      }),
    ])
    return client as RedisClient
  } catch (err) {
    console.info(`[redis] falling back to in-memory rate limits: ${err instanceof Error ? err.message : 'unknown error'}`)
    try {
      await client.destroy()
    } catch {
      // The client may already be closed after a failed first connect.
    }
    return null
  } finally {
    if (timer) clearTimeout(timer)
  }
}
