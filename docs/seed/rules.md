# seed — rules

## MUST

- **The seed must be idempotent.** Running it 1, 2, 100 times must produce the same final state. The current `findOneAndUpdate({slug}, $set, {upsert:true})` per game preserves this. Don't replace with `create` or unguarded inserts.
- **`CAMP_GAMES` is the authoritative game list.** Treat it as read-mostly source code. Edits land in `lib/seed/camp-games.ts` + a redeploy.
- **Always upsert by `slug`.** Don't upsert by name or `_id`. Slug is the stable cross-environment identifier.
- **Always preserve admin overrides.** Re-seed must not stomp `Team.loginUsername` (we check for missing first) or `Team.color` (we don't touch existing teams). See `syncTeamLoginsForSession`.
- **Always rehash `passwordHash` on every seed run.** This is how `TEAM_SEED_PASSWORD` rotates.
- **Always include `placementPoints` in the seed entry** (or rely on `defaultPoints` via `scoringForSeed`). The schema validator rejects empty arrays — but this only fires on `create`, not `findOneAndUpdate` without `runValidators: true`.
- **`ensureGameDefinitionBySlug` must use `$setOnInsert` for settings.** Tweaks via admin must survive auto-creation on `/play/<slug>`.
- **`scoringForSeed` is the only place that translates `SeedGame` → `GameScoring`.** If you change the embedded scoring shape in the schema, update this function.

## MUST NOT

- **Never hardcode `_id` in the seed.** `_id` is auto-generated; downstream code keys by `slug`.
- **Never delete games from `CAMP_GAMES` without considering `GameResult` orphans.** If a game disappears from the seed, existing definitions stay in the DB (the seed only inserts/updates), but if admin manually deletes via `/api/games/[id] DELETE`, results orphan. See [scoring/gotchas.md](../scoring/gotchas.md).
- **Never seed `GameResult` rows.** Past results are camp-data, not seed data. Seed is only for definitions.
- **Never seed `UnmaskedState` / `MindgameState`** — gameplay state is per-team and starts fresh on first play.
- **Never seed `PowerUpCode` rows.** Codes are admin-managed; the seed shouldn't decide what codes exist.
- **Never overwrite `Team.passwordHash` outside `sync-team-logins.ts` or `/api/teams PATCH` (admin path).** Random ad-hoc writes break the password-rotation guarantee.
- **Never create more than one active `Session`.** The seed checks `findOne({active: true})` and creates only when missing. If you need multi-session support, refactor — don't bypass the check.
- **Never change `Session.label` from `"Youth Camp 2026"` programmatically.** Today it's a literal in the seed route ([seed route:46](../../app/api/seed/route.ts#L46)). Future camps should bump the year (or generalize).
- **Never make the seed conditional on `NODE_ENV`.** It must work in dev, staging, and production identically.
