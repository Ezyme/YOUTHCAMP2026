# seed — architecture

## Idempotent bootstrap

Pressing **Admin → Seed** runs `POST /api/seed`, which:

1. Upserts every game in `CAMP_GAMES` by slug.
2. Ensures one `Session({ active: true })` exists, creating it if missing.
3. If the session has zero teams, inserts 6 default teams (`Team 1`…`Team 6` with paint colors).
4. Calls `syncTeamLoginsForSession(sessionId)` — assigns `team1`…`team6` as default `loginUsername` for any team without one, and bcrypt-hashes `TEAM_SEED_PASSWORD` (default `"youthcamp"`) into every team's `passwordHash`.

Idempotent: running seed twice is safe and never duplicates data. Game upserts use `findOneAndUpdate({slug}, $set, {upsert: true})`. Session uses "find or create". Teams insert only when zero exist.

## What seed does NOT touch

- **Game `settings`** when the game already exists — `settings` is sent only via `$set` if explicitly provided in the seed entry. Re-seed preserves settings the admin has tweaked. (See [gotchas.md](./gotchas.md) for nuance.)
- **`GameResult` rows** — past scores stay.
- **`UnmaskedState` / `MindgameState`** — gameplay state stays.
- **`PowerUpCode` rows** — admin-managed codes stay.
- **`loginUsername`** if a team already has one — preserved (admin overrides win).

To wipe play state without re-seeding, use `/api/admin/reset-camp` (separate button).

## The /100 rubric encoded as constants

[lib/seed/camp-games.ts](../../lib/seed/camp-games.ts) carries the camp's scoring rubric as code constants:

```ts
const W_TEAM_MINI = 25 / 120;       // each pool/field game scales by this
const W_COLLECT_FLAGS = 50 / 120;   // 2× heavy row weight
const RUBRIC_100 = "Camp total = /100: Merit 5% · Pool + field team games 25% combined · …";
```

The /100 is the camp's stated rubric:
- **Merit**: 5%
- **6 team mini-games (pool + field)** combined: 25%
- **Amazing Race**: 30%
- **Flag** (Camper's Night): 10%
- **Cheer** (Camper's Night): 10%
- **Group skit / Presentation**: 20%

The team mini-games each have a placement row whose 1st-place value sums to ~120 across 6 events. Multiplying by `W_TEAM_MINI = 25/120 = 0.2083` makes them sum to 25 if a team places 1st in every event. **Collect the Flags** is one of the 6 mini-games but counts twice, hence `W_COLLECT_FLAGS = 50/120 = 0.4167` and the row count adjusts (it's still listed once but weighted as if listed twice).

`Amazing Race` row sums to 30 at 1st (with weight 1).

Manual-mode games (Merit, Flag, Cheer, Skit) use `manualPointsMax` to cap the per-team contribution at the pillar's percent.

See [scoring/architecture.md](../scoring/architecture.md) for the full math.

## Seed payload shape

`SeedGame` ([camp-games.ts:3-19](../../lib/seed/camp-games.ts#L3-L19)) is the local seed-only shape (slightly different from `IGameDefinition` — fewer fields, no scoring subdoc inline):

```ts
type SeedGame = {
  name: string;
  slug: string;
  day: 0 | 1 | 2;
  category: string;
  engineKey: "mindgame" | "unmasked" | "config_only";
  isPlayable: boolean;
  order: number;
  scoringMode?: ScoringMode;       // → scoring.scoringMode
  placementPoints?: number[];      // → scoring.placementPoints
  weight?: number;                 // → scoring.weight
  manualPointsMax?: number;        // → scoring.manualPointsMax (omitted for placement modes)
  rulesMarkdown?: string;
  settings?: Record<string, unknown>;
};
```

`scoringForSeed(g)` ([camp-games.ts:219-230](../../lib/seed/camp-games.ts#L219-L230)) folds the shape into a `GameScoring` subdoc.

## Auto-create on `/play` first hit

`ensureGameDefinitionBySlug(slug)` ([ensure-game-definition.ts](../../lib/seed/ensure-game-definition.ts)) is the single-game upsert called from [`/play/[gameSlug]/page.tsx`](../../app/play/[gameSlug]/page.tsx) when the slug isn't found. It looks the slug up in `CAMP_GAMES` and upserts. This means a fresh DB can serve `/play/mindgame` and `/play/unmasked` without a full seed run — handy for first-touch testing.

It uses `$setOnInsert: { settings: g.settings }` so admin-customized settings aren't overwritten on subsequent calls. See [gotchas.md](./gotchas.md).

## Admin auth

`POST /api/seed` accepts the admin secret two ways:
- HTTP header `x-admin-secret`
- POST body field `secret`

If `ADMIN_SECRET` is unset, no auth required. If set, one of the two must match. The admin dashboard's `<SeedButton>` POSTs an empty body — the call works because the user's `youthcamp_admin` cookie isn't even checked here. The seed predates the admin cookie. See [gotchas.md](./gotchas.md) and [admin/gotchas.md](../admin/gotchas.md).

## Layer position

```
[Browser] /admin (SeedButton) → POST /api/seed
                                       │
                                       ▼
                       [lib/seed/camp-games.ts]    CAMP_GAMES[]
                       [lib/seed/sync-team-logins.ts]  bcrypt + assign loginUsername
                                       │
                                       ▼
                       [lib/db/models.ts → GameDefinition, Session, Team]

[Browser] /play/<slug> → SSR → ensureGameDefinitionBySlug (if missing)
                                       │
                                       ▼
                       [lib/seed/ensure-game-definition.ts]
                                       │
                                       ▼
                       [lib/db/models.ts → GameDefinition]
```
