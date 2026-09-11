# Production operations

## Sentry

Create one Sentry organization with two projects: `glitch-shift-client`
(React) and `glitch-shift-server` (Node/Fastify). Session Replay and user
feedback must remain disabled. The SDK configuration removes request bodies,
query strings, cookies, authorization/proxy headers, IP addresses, user data,
and gameplay contexts before transmission.

Configure the Vercel project with `VITE_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`,
`SENTRY_ORG`, and `SENTRY_PROJECT=glitch-shift-client`. The auth token needs
release and source-map upload access and is build-only. Vercel supplies
`VERCEL_GIT_COMMIT_SHA`, which becomes both the release and `/version.json`.

Configure Render with `SENTRY_DSN` for `glitch-shift-server` and
`SENTRY_ENVIRONMENT=production`. Render's `RENDER_GIT_COMMIT` is the release
reported by both health endpoints.

Create a server dashboard with these widgets:

- p50/p95 `http.duration`, grouped by `route` and `status_class`.
- count and percentage of `http.requests` where `status_class=5xx`.
- count of `ai.requests`, grouped by `route`, `kind`, and `outcome`; visualize
  `success` against all fallback outcomes.
- count of `rate_limit.requests`, grouped by `route`, `backend`, and `outcome`.
- count of `dependency.failures`, grouped by `dependency` and `operation`.

Create a client dashboard showing error count by release and browser HTTP span
duration by API route. Production traces are sampled at 10%; errors are kept at
100%. Local/test processes send nothing unless explicitly given a DSN.

## Better Stack

Create two private monitors manually; do not store a Better Stack API token in
either repository.

| Name | Type and assertion | URL | Frequency | Regions |
| --- | --- | --- | --- | --- |
| Glitch Shift frontend | Keyword: `<title>Glitch Shift Arcade</title>` | `https://react-game-ai.vercel.app` | 60 seconds | EU and US |
| Glitch Shift API | Keyword: `"ready":true` | `https://react-game-ai-server.onrender.com/health/ready` | 60 seconds | EU and US |

Enable redirect following. Disable email, SMS, phone, push, critical alerts,
and escalation. Do not create or publish a status page. The monitor dashboard
is the only incident destination for this milestone.

## Verification and incident triage

Deploy workflows reject a frontend `/version.json` or backend `/health`
release that differs from the tested GitHub commit. After first setup, trigger
one deliberate test exception in each Sentry project and verify that its stack
trace resolves to source while containing none of the prohibited data above.
Remove the test trigger after verification.

Use `X-Request-ID` to correlate a client-visible failure with the server's JSON
completion log. Logs contain only request ID, method, route template, status,
and duration. `/health` proves the process is alive. `/health/ready` returns
503 when PostgreSQL is unavailable; Redis failure is `degraded` with HTTP 200
because the service intentionally falls back to in-memory rate limiting.
