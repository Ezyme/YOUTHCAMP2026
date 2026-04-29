# seed — backend

## `lib/seed/camp-games.ts`

[Source](../../lib/seed/camp-games.ts). The single source of truth for the camp's game list.

### Exports

- `CAMP_GAMES: SeedGame[]` — the 13-row camp game list.
- `scoringForSeed(g: SeedGame): GameScoring` — folds the seed shape into the embedded scoring subdoc.

### Local types

```ts
type SeedGame = {
  name, slug, day, category, engineKey, isPlayable, order,
  scoringMode?, placementPoints?, weight?, manualPointsMax?,
  rulesMarkdown?, settings?,
};
```

### Constants

```ts
const defaultPoints = [12, 11, 10, 9, 8, 7];
const ROW_LIGHT = [15, 13, 11, 10, 9, 8, 7];   // 7 entries — slot 6 is unused
const ROW_HEAVY = [20, 18, 16, 15, 14, 13];
const AMAZING_RACE_POINTS = [30, 28, 26, 25, 24, 23];
const W_TEAM_MINI = 25 / 120;     // 0.2083
const W_COLLECT_FLAGS = 50 / 120; // 0.4167
```

`ROW_LIGHT` has 7 entries but the schema validator rejects `placementPoints.length !== 6`. The seed compiles because `scoringForSeed` does NOT slice — it passes the full array through. **This actually fails Mongoose validation on insert** unless something else trims it. Looking at the call chain:

```ts
$set.scoring = scoringForSeed(g);  // includes the 7-entry array verbatim
```

The seed has been running successfully, so either:
- Mongoose silently truncates `[Number]` arrays to the schema-typed length (it does NOT — verified)
- The validator is bypassed on `findOneAndUpdate` without `runValidators: true` ([camp-games.ts seed route:36-40](../../app/api/seed/route.ts#L36-L40)) — **this is the actual reason**.

The seed route omits `runValidators` (default for `findOneAndUpdate` is false). Once inserted, `placementPoints[6]` is the 7th entry stored verbatim. Reads work; the leaderboard math uses indices `0..5` and ignores the extra. **Don't rely on this** — it's a latent bug. See [gotchas.md](./gotchas.md).

### `scoringForSeed`

```ts
export function scoringForSeed(g: SeedGame) {
  const base = {
    maxPlacements: 6,
    scoringMode: g.scoringMode ?? "placement_points",
    placementPoints: g.placementPoints ?? defaultPoints,
    weight: g.weight ?? 1,
  };
  if (g.manualPointsMax != null) {
    return { ...base, manualPointsMax: g.manualPointsMax };
  }
  return base;
}
```

`manualPointsMax` is included only for manual-mode games (the schema doesn't reject it on placement modes, but the route omits it for clarity).

## `lib/seed/sync-team-logins.ts`

[Source](../../lib/seed/sync-team-logins.ts).

### `getTeamSeedPassword()`
Reads `TEAM_SEED_PASSWORD` from env (trimmed). Defaults to `"youthcamp"`.

### `syncTeamLoginsForSession(sessionId): Promise<{ usernames: string[] }>`

1. Computes the bcrypt hash of the seed password (one hash for all teams — same plaintext).
2. Loads teams sorted by `sortOrder, name`.
3. For each team, if `loginUsername` is empty, assigns `team${i+1}`.
4. **Always** updates `passwordHash` (every team gets the fresh hash).

Returns the list of usernames in order. The seed route surfaces this list to the admin so they know what credentials to hand out.

### Why hash once and reuse

The plaintext is the same for all teams. Bcrypt is expensive (10 rounds = ~200ms). One hash, six writes is a 5x speedup over six independent hashes.

A future "per-team unique password" feature would need to hash per row.

## `lib/seed/ensure-game-definition.ts`

[Source](../../lib/seed/ensure-game-definition.ts).

### `ensureGameDefinitionBySlug(slug): Promise<boolean>`

Returns `false` if the slug isn't in `CAMP_GAMES`. Otherwise upserts a single game definition. Used by `/play/[gameSlug]` to auto-create a missing definition for known slugs.

The upsert payload uses `$setOnInsert: { settings: g.settings }` — which means **settings are only written on initial insert**, not on subsequent runs. This preserves admin-tweaked settings.

The seed route (full seed) uses `$set.settings = g.settings` only when `g.settings !== undefined`. Difference: the full seed will overwrite settings if the seed entry has them; the single-slug ensure won't. See [gotchas.md](./gotchas.md).

## `/api/seed` route

[Source](../../app/api/seed/route.ts). POST. Optional admin auth via header `x-admin-secret` or body `secret` (when `ADMIN_SECRET` is set). Iterates `CAMP_GAMES`, upserts each. Ensures session + teams + login sync. Returns counts and usernames.

## What seed does NOT include

- Cloudinary asset uploads — `mediaUrl` and `mediaPublicId` are not in the seed shape.
- Per-team password customization — single shared password.
- Power-up codes — admin-managed via `/admin/power-ups`.
- Camp-name customization — `Session.label` is hardcoded `"Youth Camp 2026"` ([seed route:46](../../app/api/seed/route.ts#L46)).
