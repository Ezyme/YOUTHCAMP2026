# camp-auth — Team login & camp gate

Per-team accounts with bcrypt passwords + a session cookie. Distinct from admin auth. Gates `/camp/**`, `/play/**`, and team-bound API routes.

## What lives in this folder

- [lib/camp/auth.ts](../../lib/camp/auth.ts) — Cookie names, gate enable check, `safeCampLoginNext` open-redirect guard.
- [lib/camp/password.ts](../../lib/camp/password.ts) — bcrypt hash/verify wrappers (10 salt rounds).
- [lib/camp/team-game-access.ts](../../lib/camp/team-game-access.ts) — Server helpers that resolve the cookie team for game routes.
- [app/api/camp/login/route.ts](../../app/api/camp/login/route.ts), [logout/](../../app/api/camp/logout/route.ts), [select-team/](../../app/api/camp/select-team/route.ts)
- [app/login/page.tsx](../../app/login/page.tsx) + [camp-login-form.tsx](../../app/login/camp-login-form.tsx)
- [app/camp/page.tsx](../../app/camp/page.tsx)
- [components/camp/](../../components/camp/) — dashboard + logout buttons

## Docs in this folder

| File | What it covers |
|---|---|
| [architecture.md](./architecture.md) | The two-cookie model, gate logic, where each cookie is read |
| [flows.md](./flows.md) | Login flow, gate redirect flow, team-pick flow (mermaid) |
| [models.md](./models.md) | `Team.loginUsername` + `passwordHash` reference and partial-unique index |
| [frontend.md](./frontend.md) | `/login` page, camp dashboard, logout buttons |
| [backend.md](./backend.md) | `lib/camp/**` helpers and what each one does |
| [api.md](./api.md) | `/api/camp/login`, `/logout`, `/select-team` |
| [rules.md](./rules.md) | Open-redirect prevention, cookie flags, gate-disabled fast-path |
| [patterns.md](./patterns.md) | Cookie auth conventions used across the codebase |
| [recipes.md](./recipes.md) | How to add a team-bound route · enable/disable gate · change passwords |
| [env.md](./env.md) | `CAMP_LOGIN_PASSWORD`, `CAMP_REQUIRE_LOGIN`, `TEAM_SEED_PASSWORD` |
| [gotchas.md](./gotchas.md) | Soft-nav cookie loss, the gate-off path, stale `select-team` cookie |

## Related domains

- [seed](../seed/README.md) — bootstraps team accounts (`team1`…`team6`) via `syncTeamLoginsForSession`.
- [teams](../teams/README.md) — `/api/teams` PATCH bulk-updates passwords.
- [admin](../admin/README.md) — independent cookie auth, do not conflate.
- [infrastructure](../infrastructure/README.md) — `middleware.ts` enforces the gate at the edge.
- [db](../db/README.md) — `Team` model owns `loginUsername` + `passwordHash`.
