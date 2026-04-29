# admin — Camp facilitator surface

Single-secret admin auth + the panel for managing games, teams, scoring, power-up codes, and the Unmasked spectator view.

## What lives in this folder

- **Pages** under [app/admin/](../../app/admin/):
  - `/admin/login` — secret entry form
  - `/admin` (dashboard with seed + reset)
  - `/admin/games`, `/admin/games/new`, `/admin/games/[id]/edit`
  - `/admin/teams`
  - `/admin/scoring`
  - `/admin/unmasked` (per-team spectator)
  - `/admin/power-ups` (redemption codes)
- **API** under [app/api/admin/](../../app/api/admin/):
  - `/api/admin/login`, `/api/admin/reset-camp`
  - `/api/admin/unmasked/state`, `/reset`, `/teams`, `/power-up-grant-all`
- **Lib** [lib/admin-auth.ts](../../lib/admin-auth.ts) — `verifyAdminRequest()` cookie check.
- **Components** under [components/admin/](../../components/admin/):
  - `game-form.tsx` — create/edit a `GameDefinition`
  - `power-ups-admin.tsx` — manage `PowerUpCode` rows
  - `teams-client.tsx` — rename teams, set usernames, bulk-update password
  - `unmasked-teams-admin.tsx` — spectator dashboard

## Docs in this folder

| File | What it covers |
|---|---|
| [architecture.md](./architecture.md) | Two-tier gating (page middleware + per-handler), the (`panel`) route group |
| [models.md](./models.md) | What admin reads/writes (it touches nearly every model) |
| [frontend.md](./frontend.md) | Admin pages and components |
| [backend.md](./backend.md) | `verifyAdminRequest()` semantics |
| [api.md](./api.md) | Every admin API route — body, auth, response shape |
| [rules.md](./rules.md) | Per-handler auth check is mandatory; ADMIN_SECRET unset = open |
| [patterns.md](./patterns.md) | Server-component admin pages with client-component sub-panels |
| [recipes.md](./recipes.md) | Add a panel page · add a new admin API · enforce admin on a non-admin route |
| [env.md](./env.md) | `ADMIN_SECRET` |
| [gotchas.md](./gotchas.md) | Empty `ADMIN_SECRET` opens the door, hardcoded cookie name |

## Related domains

- [camp-auth](../camp-auth/README.md) — independent auth (camp uses `youthcamp_camp_auth`, admin uses `youthcamp_admin`).
- [seed](../seed/README.md) — the dashboard's Seed button calls `/api/seed`, not an admin-namespaced route.
- [unmasked](../unmasked/README.md) — `/admin/unmasked` is admin's spectator view of unmasked state.
- [scoring](../scoring/README.md) — `/admin/scoring` writes to the public `/api/game-results` route.
- [teams](../teams/README.md) — `/admin/teams` writes to public-namespaced `/api/teams` routes.
