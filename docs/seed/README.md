# seed — Bootstrap data & reset

Single Admin → Seed button that idempotently creates Day 0–2 game definitions, ensures an active session, populates 6 teams, and assigns `team1`…`team6` login credentials.

## What lives in this folder

- [lib/seed/camp-games.ts](../../lib/seed/camp-games.ts) — `CAMP_GAMES` list + scoring constants + RUBRIC_100 markdown.
- [lib/seed/sync-team-logins.ts](../../lib/seed/sync-team-logins.ts) — assign default usernames + bcrypt the seed password.
- [lib/seed/ensure-game-definition.ts](../../lib/seed/ensure-game-definition.ts) — single-game upsert (used by `/play/[gameSlug]`).
- [app/api/seed/route.ts](../../app/api/seed/route.ts) — POST seed endpoint.
- [components/admin/seed-button.tsx](../../components/admin/seed-button.tsx) — admin dashboard button.
- [components/admin/reset-camp-button.tsx](../../components/admin/reset-camp-button.tsx) — separate reset button (lives here logically; calls `/api/admin/reset-camp`).

## Docs in this folder

| File | What it covers |
|---|---|
| [architecture.md](./architecture.md) | The /100 rubric encoded as constants, idempotent seed shape |
| [models.md](./models.md) | What the seed writes (`GameDefinition`, `Session`, `Team`) |
| [frontend.md](./frontend.md) | `<SeedButton>`, `<ResetCampButton>` |
| [backend.md](./backend.md) | `CAMP_GAMES`, `scoringForSeed`, `syncTeamLoginsForSession`, `ensureGameDefinitionBySlug` |
| [api.md](./api.md) | `POST /api/seed` |
| [rules.md](./rules.md) | Idempotent, slug-keyed, password rotation via env |
| [patterns.md](./patterns.md) | Seed shape, weight constants for the /100 rubric |
| [recipes.md](./recipes.md) | Add a new game · change camp password · reset rosters |
| [gotchas.md](./gotchas.md) | Settings preservation on re-seed, `setOnInsert` semantics, Default vs override |

## Related domains

- [games-shared](../games-shared/README.md) — `GameDefinition` schema and `/api/games` CRUD.
- [scoring](../scoring/README.md) — point rows + weights live here in this folder, but math is in scoring.
- [teams](../teams/README.md) — team CRUD; seed creates initial 6.
- [camp-auth](../camp-auth/README.md) — `TEAM_SEED_PASSWORD` is the default for the bcrypt hash.
- [admin](../admin/README.md) — seed runs from the admin dashboard.
