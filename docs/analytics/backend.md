# analytics — backend

_N/A as standalone — both routes are thin wrappers._

| Route | Delegates to |
|---|---|
| `/api/camp/analytics` | [`getComebackAnalytics(sessionId, teamId)`](../../lib/scoring/comeback.ts) — see [scoring/backend.md](../scoring/backend.md) |
| `/api/public/session` | Direct Mongoose reads on `Session` + `Team` (no separate lib helper) |

The public/session route's read logic could be promoted to `lib/camp/session-info.ts` if it grows. Today it's 25 lines inline.

For full reference, see [api.md](./api.md).
