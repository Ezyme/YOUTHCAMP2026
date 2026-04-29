# teams — backend

_N/A as a standalone module — this domain is HTTP routing on top of `lib/db/models.ts → Team`._

The handlers in [`/api/teams/route.ts`](../../app/api/teams/route.ts) and [`/api/teams/[id]/route.ts`](../../app/api/teams/[id]/route.ts) are thin. They delegate to:

- [`lib/camp/password.ts`](../../lib/camp/password.ts) — `hashPassword(plain)` for the bulk PATCH.
- [`lib/seed/sync-team-logins.ts`](../../lib/seed/sync-team-logins.ts) — `syncTeamLoginsForSession(sessionId)` for the bootstrap path of POST.

See [api.md](./api.md) for the route reference.
