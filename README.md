# react-game-ai-server

Standalone API backend for `react-game-ai`.

## Routes

- `GET /health`
- `POST /api/director`
- `GET /api/meme-theme`
- `POST /api/meme-theme`
- `GET /api/scores?limit=10`
- `POST /api/scores`

The game treats `204` from AI routes as the normal fallback signal. Missing `ANTHROPIC_API_KEY`, rate-limit hits, Anthropic failures, refusals, timeouts, and invalid model output all return `204`.

Adult meme mode remains client-catalog-only for v1. Requests with `adultMode: true` return `204` and do not call Anthropic.

## Environment

- `ANTHROPIC_API_KEY`: server-only Anthropic key.
- `DATABASE_URL`: Postgres connection string. If omitted, scores use local JSON storage.
- `REDIS_URL`: Redis connection string. If omitted, rate limits use in-memory buckets.
- `CORS_ORIGINS`: comma-separated allowed frontend origins.
- `PORT`: defaults to `8787`.
- `SCORES_FILE`: local JSON fallback path, defaults to `./data/scores.json`.

## Local Dev

Create `.env.local` in this server directory with your server-only key:

```dotenv
ANTHROPIC_API_KEY=your-key-here
```

The dev, start, and migration commands load `.env.local` when present. Existing environment variables take precedence. Restart the server after changing the file.

```sh
npm install
npm run db:migrate
npm run dev
```

The frontend proxies `/api` to `http://localhost:8787`.

The game requests the next stage plan once the current stage has eight seconds remaining, using gameplay metrics collected so far. The three-second warning stays generic. At the transition, the game uses the available AI plan or its heuristic fallback without waiting; late responses cannot replace that choice. The final eight seconds are not included in the AI snapshot. Pausing freezes the stage countdown while an existing request may finish (subject to its 20-second wall-clock timeout).

For `/api/director`, check the request method in the browser's Network panel: `OPTIONS` returning `204` is a normal CORS preflight. A `POST` returning `204` means no AI plan was supplied and the game uses its heuristic director. A successful AI response is `200` with JSON. Check the server terminal for a missing-key warning or `[director]` upstream failure logs when POST requests keep returning `204`.

## Render

Use `render.yaml` as the blueprint. It creates:

- `react-game-ai-server` web service
- `react-game-ai-db` Postgres database
- `react-game-ai-redis` Redis instance

Set `ANTHROPIC_API_KEY` and `CORS_ORIGINS` as Render secrets/env vars. The build command runs `npm ci`, typecheck, and `npm run db:migrate`; the start command is `npm run start`.
