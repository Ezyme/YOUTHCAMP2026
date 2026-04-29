# analytics — architecture

## Two thin routes

This domain is two HTTP endpoints, both read-only, both thin wrappers over functions that live in other domains.

### `GET /api/camp/analytics?sessionId&teamId`

Wraps [`getComebackAnalytics`](../../lib/scoring/comeback.ts) from the scoring domain. Used by the camp dashboard's team picker to refetch when the user switches teams. The same function is also called server-side from `/camp` page SSR — this route is the client-fetch path.

### `GET /api/public/session`

Returns the latest `Session` + its teams (id, name, color, loginUsername) with **no secrets** (no `passwordHash`, no `_id` aliases, etc.). Used by `<CampLoginForm>` to render the team selector before login.

The "public" name marks intent: this route is safe to expose to unauthenticated users. It powers the login UI.

## Why these are separate routes

`/api/camp/analytics` requires `sessionId + teamId` (computes per-team gap math). `/api/public/session` returns a list. Different shapes, different consumers.

The analytics route lives under `/api/camp/*` because conceptually it's camp-team data — but **today it has no auth check**. The middleware doesn't gate `/api/*` and the route doesn't call `requireAuth`. Camp gameplay routes do — analytics doesn't. See [rules.md](./rules.md).

The public/session route is named `/api/public/*` to make its publicness explicit.

## Layer position

```
[Browser /camp dashboard] ──→ /api/camp/analytics
                                    │
                                    ▼
                       lib/scoring/comeback.ts
                                    │
                                    ▼
                       Team, Session, GameDefinition, GameResult

[Browser /login form] ──→ /api/public/session
                              │
                              ▼
                       Session + Team (read, no passwordHash)
```

## What this domain does NOT have

- Real-time analytics (web sockets / SSE). Both endpoints are simple GETs.
- Aggregation pipelines. The data is small; in-memory rollup is enough.
- A separate model. Reads only.
