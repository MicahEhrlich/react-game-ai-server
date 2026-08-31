export interface ServerConfig {
  readonly anthropicApiKey?: string
  readonly host: string
  readonly port: number
  readonly allowedOrigins: readonly string[]
  readonly scoresFile: string
  readonly databaseUrl?: string
  readonly redisUrl?: string
  readonly nodeEnv: string
}

function splitOrigins(raw: string | undefined): readonly string[] {
  return (raw ?? 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const port = Number(env.PORT ?? 8787)
  return {
    anthropicApiKey: env.ANTHROPIC_API_KEY,
    host: env.HOST ?? '0.0.0.0',
    port: Number.isFinite(port) && port > 0 ? port : 8787,
    allowedOrigins: splitOrigins(env.CORS_ORIGINS),
    scoresFile: env.SCORES_FILE ?? './data/scores.json',
    databaseUrl: env.DATABASE_URL,
    redisUrl: env.REDIS_URL,
    nodeEnv: env.NODE_ENV ?? 'development',
  }
}
