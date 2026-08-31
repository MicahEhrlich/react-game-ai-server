# react-game-ai-server

Standalone API backend for `react-game-ai`.

## Routes

- `GET /health`
- `POST /api/director`
- `GET /api/meme-theme`
- `POST /api/meme-theme`

The game treats `204` as the normal fallback signal. Missing `ANTHROPIC_API_KEY`, rate-limit hits, Anthropic failures, refusals, timeouts, and invalid model output all return `204`.

Adult meme mode remains client-catalog-only for v1. Requests with `adultMode: true` return `204` and do not call Anthropic.

## Dev

```sh
npm install
npm run dev
```

The frontend proxies `/api` to `http://localhost:8787`.
