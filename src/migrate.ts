import { createPgPool } from './db.ts'

export async function migrate(databaseUrl = process.env.DATABASE_URL): Promise<void> {
  const pool = createPgPool(databaseUrl)
  if (!pool) {
    console.info('[db] no DATABASE_URL; skipping Postgres migration')
    return
  }
  try {
    await pool.query('create extension if not exists pgcrypto')
    await pool.query(`
      create table if not exists scores (
        id uuid primary key default gen_random_uuid(),
        name text not null,
        score integer not null,
        shifts integer not null,
        created_at timestamptz not null default now(),
        client_at bigint null
      )
    `)
    await pool.query(`
      create index if not exists scores_rank_idx
      on scores (score desc, shifts desc, created_at asc)
    `)
  } finally {
    await pool.end()
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await migrate()
}
