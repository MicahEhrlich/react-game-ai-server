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

Run the local lint, unit-test, and typecheck gate with `npm run ci:check`.

The frontend proxies `/api` to `http://localhost:8787`.

The game requests the next stage plan once the current stage has eight seconds remaining, using gameplay metrics collected so far. The three-second warning stays generic. At the transition, the game uses the available AI plan or its heuristic fallback without waiting; late responses cannot replace that choice. The final eight seconds are not included in the AI snapshot. Pausing freezes the stage countdown while an existing request may finish (subject to its 20-second wall-clock timeout).

For `/api/director`, check the request method in the browser's Network panel: `OPTIONS` returning `204` is a normal CORS preflight. A `POST` returning `204` means no AI plan was supplied and the game uses its heuristic director. A successful AI response is `200` with JSON. Check the server terminal for a missing-key warning or `[director]` upstream failure logs when POST requests keep returning `204`.

## Render

Use `render.yaml` as the blueprint. It creates:

- `react-game-ai-server` web service
- `react-game-ai-db` Postgres database
- `react-game-ai-redis` Render Key Value instance (Redis-compatible)

Set `ANTHROPIC_API_KEY` and `CORS_ORIGINS` as Render secrets/env vars. Render
sets `NODE_ENV=production` automatically at runtime. It waits for the
repository's GitHub checks before deploying `main`. The build command installs
production and development dependencies so TypeScript is available for the
typecheck, database migrations run as a pre-deploy command, and `/health` gates
the new service instance before it receives traffic.

## GitHub Actions

Create a GitHub Environment named `production` under **Settings → Environments**.
Configure these values in that environment:

- Secret `RENDER_API_KEY`: create it under Render **Account Settings → API Keys**.
- Variable `RENDER_SERVICE_ID`: the `srv-...` identifier for the backend service.
- Variable `RENDER_SERVICE_URL`: the public HTTPS service origin without a trailing slash.

The **Backend CI/CD** workflow runs lint, unit tests, typechecking, the database
migration, and integration tests against disposable PostgreSQL and Redis services.
Pull requests and pushes to `main` run the quality gate. Successful `main` pushes
deploy through Render's **After CI Checks Pass** setting. A manual workflow run on
`main` deploys the exact tested commit through the Render API and smoke-tests the
production health and scores endpoints. Manual runs on other branches only run
the quality gate.

After the first CI/CD commit is merged, sync the Render Blueprint so
`autoDeployTrigger: checksPass` and the pre-deploy migration command take effect.
In GitHub's branch rules for `main`, require **Backend quality**, require branches
to be up to date, restrict direct pushes, and block force pushes.
