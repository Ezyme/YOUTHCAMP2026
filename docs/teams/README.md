# teams — Team CRUD API

Just the routes under `/api/teams`. The schema is in [db](../db/README.md), the admin UI is in [admin](../admin/README.md), and login bootstrap is in [seed](../seed/README.md). This domain is the public-namespaced HTTP surface.

## What lives in this folder

- [app/api/teams/route.ts](../../app/api/teams/route.ts) — list, create, bulk-update password.
- [app/api/teams/[id]/route.ts](../../app/api/teams/[id]/route.ts) — patch, delete.

## Docs in this folder

| File | What it covers |
|---|---|
| [architecture.md](./architecture.md) | Public-namespaced (no auth check), used by admin panel + camp picker |
| [frontend.md](./frontend.md) | _N/A — no UI lives here_ |
| [backend.md](./backend.md) | _N/A — handlers are thin; see api.md_ |
| [api.md](./api.md) | Every method on `/api/teams` and `/api/teams/[id]` |
| [rules.md](./rules.md) | Auth gap, lowercased usernames, partial-unique index |
| [patterns.md](./patterns.md) | Bulk-PATCH for password, bootstrap flag |
| [gotchas.md](./gotchas.md) | No cascade on delete, seed duplicates the bootstrap path |

## Related domains

- [db](../db/README.md) — `Team` schema lives here.
- [camp-auth](../camp-auth/README.md) — `passwordHash` is bcrypt; teams API touches it.
- [admin](../admin/README.md) — `<TeamsClient>` is the admin UI for these routes.
- [seed](../seed/README.md) — bootstraps the initial 6 teams.
