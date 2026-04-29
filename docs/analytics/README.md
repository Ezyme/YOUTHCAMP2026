# analytics — Comeback analytics + public session info

Two read-only routes used by the camp dashboard to compute "where are we in the standings" and to bootstrap login pickers.

## What lives in this folder

- [app/api/camp/analytics/route.ts](../../app/api/camp/analytics/route.ts) — `GET /api/camp/analytics` (wraps `getComebackAnalytics`).
- [app/api/public/session/route.ts](../../app/api/public/session/route.ts) — `GET /api/public/session` (latest session + team list, no secrets).

## Docs in this folder

| File | What it covers |
|---|---|
| [architecture.md](./architecture.md) | Two routes, both thin wrappers; one over scoring, one over Session+Team |
| [models.md](./models.md) | _N/A — no models owned here; reads `Team`, `Session`, `GameResult`, `GameDefinition`_ |
| [frontend.md](./frontend.md) | `<CampDashboard>` calls analytics; login picker calls public/session |
| [backend.md](./backend.md) | _N/A — handlers delegate to lib/scoring_ |
| [api.md](./api.md) | Both routes |
| [rules.md](./rules.md) | No secrets in public/session, validate ObjectIds |
| [patterns.md](./patterns.md) | Wrapper-over-lib, shaped responses |
| [gotchas.md](./gotchas.md) | Non-existent session+team returns null; analytics returns null on no-teams |

## Related domains

- [scoring](../scoring/README.md) — `getComebackAnalytics` lives there.
- [camp-auth](../camp-auth/README.md) — `<CampLoginForm>` uses `/api/public/session` to populate the team picker.
- [db](../db/README.md) — `Team`, `Session` shapes.
