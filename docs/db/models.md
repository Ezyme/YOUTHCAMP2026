# db — models reference

All schemas live in [lib/db/models.ts](../../lib/db/models.ts). One section per model. Field types and indexes are pulled directly from the source — when you change the schema, update this file.

---

## `Event`

[models.ts:235-242](../../lib/db/models.ts#L235-L242)

| Field | Type | Notes |
|---|---|---|
| `name` | String, required | Display label for an event (multi-day camp) |
| `startsAt` | Date | Optional |
| `endsAt` | Date | Optional |

Timestamps: `createdAt`, `updatedAt`.

**Use:** Currently unused by routes. Reserved for future multi-event support — `Session` has an optional `eventId` ref.

---

## `Session`

[models.ts:244-251](../../lib/db/models.ts#L244-L251)

| Field | Type | Notes |
|---|---|---|
| `label` | String, required | Display label, e.g. `"Youth Camp 2026"` |
| `eventId` | ObjectId → Event | Optional |
| `active` | Boolean, default true | Currently the seed only ever creates one |

Timestamps: yes.

**Use:** Most queries find the latest by `Session.findOne().sort({ createdAt: -1 })` rather than relying on `active`. Both patterns coexist (seed uses `{ active: true }`, most reads use the sort approach).

---

## `Team`

[models.ts:253-280](../../lib/db/models.ts#L253-L280)

| Field | Type | Notes |
|---|---|---|
| `name` | String, required | Display name (e.g. `"Team 1"`) |
| `color` | String, default `#6366f1` | Hex color used in UI badges |
| `sessionId` | ObjectId → Session, required, indexed | Each team belongs to one session |
| `sortOrder` | Number, default 0 | Used to order teams in admin/UI |
| `loginUsername` | String, lowercase, trimmed | Camp dashboard login id (e.g. `team1`) |
| `passwordHash` | String, **`select: false`** | bcrypt hash; never returned by default |

**Indexes:**
- `{ sessionId: 1, sortOrder: 1 }` — compound, for ordered fetches
- `{ sessionId: 1, loginUsername: 1 }` — **partial** unique with filter `{ loginUsername: { $gt: "" } }` ([models.ts:274](../../lib/db/models.ts#L274))

**Why partial unique?** A plain sparse unique would treat multiple teams with no `loginUsername` as duplicate `(sessionId, null)` and block bootstrapping six teams in one `insertMany`. The partial filter only enforces uniqueness when `loginUsername` is non-empty. See [gotchas.md](./gotchas.md).

`Team.syncIndexes()` is called on first `dbConnect()` to migrate legacy sparse-unique to partial-unique.

---

## `GameDefinition`

[models.ts:186-233](../../lib/db/models.ts#L186-L233)

| Field | Type | Notes |
|---|---|---|
| `name` | String, required | Display name |
| `slug` | String, **unique**, required | URL slug (`mindgame`, `unmasked`, `salbabida-race`, …) |
| `day` | Number, required, 0–2 | 0 = reference / merit; 1 = pool games; 2 = field + Camper's Night |
| `category` | String, required | Free-form (e.g. `"Pool games"`, `"Amazing Race"`, `"Camper's Night"`) |
| `engineKey` | enum: `"mindgame" \| "unmasked" \| "config_only"` | Drives which board renders |
| `settings` | Mixed, default `{}` | Engine-specific config (e.g. Unmasked grid + verses) |
| `scoring` | embedded `GameScoring` | See below |
| `rulesMarkdown` | String, default `""` | Rendered on the game detail page |
| `order` | Number, default 0 | Sort order within a day |
| `isPlayable` | Boolean, default false | True for `mindgame` / `unmasked`; false for facilitator-judged events |
| `mediaUrl` | String | Cloudinary secure URL |
| `mediaPublicId` | String | Cloudinary public id (for re-upload / delete) |

Timestamps: yes.

**Embedded `scoring` shape (`GameScoring`):**
- `maxPlacements`: Number, default 6
- `scoringMode`: enum `"placement_points" | "amazing_race_finish" | "amazing_race_first_only" | "manual_points"`, default `"placement_points"`
- `placementPoints`: `[Number]`, validated to have **exactly 6 entries** ([models.ts:212-219](../../lib/db/models.ts#L212-L219))
- `weight`: Number, default 1, min 0 (Amazing Race uses 50/120, Collect-the-Flags uses 50/120, etc.)
- `manualPointsMax`: Number 0–100 (only set when `scoringMode === "manual_points"`)

---

## `MindgameState`

[models.ts:282-309](../../lib/db/models.ts#L282-L309)

Persists per-team mindgame puzzle state.

| Field | Type | Notes |
|---|---|---|
| `sessionId` | ObjectId → Session, default null | Optional — anonymous shared boards have null |
| `teamId` | ObjectId → Team, default null | Optional |
| `clientKey` | String, required | Distinguishes multiple boards per session+team (UI tab id) |
| `gridRows`, `gridCols` | Number, required | 10×3 standard, 8×3 quick |
| `playerCount` | Number, required | 10 / 8 |
| `positions` | `[{ pinIndex, r, c }]` | Pin positions on the lattice |
| `blocked` | `[{ r, c }]`, default `[]` | Wall coordinates persisted with the save |
| `diagonalNodes` | `[{ r, c }]`, default `[]` | Vertices that allow diagonals |
| `goal` | String, required | `"sort_desc" \| "sort_asc" \| "odd_even"` |
| `moves` | Number, default 0 | Move counter |

Timestamps: yes.

**Index:** `{ clientKey: 1, sessionId: 1, teamId: 1 }` **unique compound** ([models.ts:311-314](../../lib/db/models.ts#L311-L314)).

The unique tuple lets multiple groups share the same `clientKey` if they have different team ids, and the same team have multiple boards keyed differently.

---

## `GameResult`

[models.ts:316-348](../../lib/db/models.ts#L316-L348)

The leaderboard row. One per `(session, game, team)`.

| Field | Type | Notes |
|---|---|---|
| `sessionId` | ObjectId → Session, required, indexed | |
| `gameId` | ObjectId → GameDefinition, required, indexed | |
| `teamId` | ObjectId → Team, required, indexed | |
| `placement` | Number, required, 1–6 | Always 1–6 even for `manual_points` (rank by score) |
| `pointsAwarded` | Number, required | Already weighted (computed at write time) |
| `completedAt` | Date | Optional, when the placement was earned |
| `notes` | String | Free-form facilitator notes |
| `updateReason` | String | Free-form audit field for adjustments |

Timestamps: yes.

**Index:** `{ sessionId: 1, gameId: 1, teamId: 1 }` **unique compound** ([models.ts:345-348](../../lib/db/models.ts#L345-L348)) — prevents double-scoring a team for the same game.

Writes go through `bulkWrite` upserts in [app/api/game-results/route.ts](../../app/api/game-results/route.ts) (see [scoring/api.md](../scoring/api.md)).

---

## `UnmaskedState`

[models.ts:350-415](../../lib/db/models.ts#L350-L415)

Largest schema in the project. Persists Unmasked (Minesweeper-style) gameplay per team.

| Field | Type | Notes |
|---|---|---|
| `sessionId` | ObjectId → Session, required, indexed | |
| `teamId` | ObjectId → Team, required, indexed | |
| `seed` | Number, required | Mulberry32 seed; deterministic board layout |
| `gridSize` | Number, required | Square grid (e.g. 20) |
| `totalLies` | Number, required | Lie tile count |
| `revealed` | `[Number]`, default `[]` | Flat tile indices revealed |
| `flagged` | `[Number]`, default `[]` | Flat indices flagged |
| `hearts` | Number, required | Current hearts |
| `maxHearts` | Number, required | Max (grows with `extra_heart` redemptions) |
| `verseKey` | String | **@deprecated** — old single-verse field |
| `verseKeys` | `[String]`, default `[]` | Verse pool on this board |
| `verseFragments` | `[{ index, text, order, verseKey }]` | Fragments placed on tiles |
| `verseAssemblyIndices` | `[Number]`, default `[]` | Fragments currently in the builder row |
| `verseAssembly` | `[Number]`, default `[]` | **@deprecated** — superseded by `verseAssemblyIndices` |
| `versesRestored` | `[String]`, default `[]` | Verse keys that have been correctly assembled |
| `verseCheckAttemptsByKey` | Mixed, default `{}` | Per-verse failed check counter (capped before forfeit) |
| `versesGivenUp` | `[String]`, default `[]` | Verse keys forfeited (no score) |
| `verseScore` | Number, default 0 | Sum of fragments restored |
| `verseCompleted` | Boolean | **@deprecated** — superseded by `versesRestored` |
| `redeemedCodes` | `[String]`, default `[]` | Power-up codes already redeemed |
| `powerUps` | `[{ type, used }]` | Inventory; subdoc validated against `UNMASKED_POWER_UP_ENUM` |
| `shielded` | Boolean, default false | Active shield blocks next lie |
| `status` | enum `"playing" \| "won" \| "lost"`, default `"playing"` | |
| `liesHit` | Number, default 0 | |
| `startedAt` | Date, default now | Timer start; preserved across "New board" |
| `lastPlayActivityAt` | Date | Bumped on play GET / actions; admin reads do not bump |
| `finishedAt` | Date | Set when status flips to `won`/`lost` or all passages complete |
| `passagesComplete` | Boolean, default false | True when all verses on this board are restored |
| `checkPassagePenaltySeconds` | Number, default 0 | Sum of penalty seconds from wrong "Check passage" attempts |
| `finalScore` | Number | **@deprecated** — old composite |
| `scoreBreakdown` | `{ board, verses, hearts }` | Optional breakdown matching the deprecated `finalScore` |
| `submittedAt` | Date | When the player locked in the score |

Timestamps: yes.

**Index:** `{ sessionId: 1, teamId: 1 }` **unique compound** ([models.ts:417](../../lib/db/models.ts#L417)) — one Unmasked save per team per session.

**Subdoc:** `UnmaskedPowerUpEntrySchema` (`{ type, used }`) — validated against `UNMASKED_POWER_UP_ENUM` ([models.ts:103-114](../../lib/db/models.ts#L103-L114)).

**Dev HMR reset:** `mongoose.models.UnmaskedState` is deleted in development before re-registration ([models.ts:472-474](../../lib/db/models.ts#L472-L474)) so a stale cached enum does not reject newly added power-up types.

---

## `PowerUpCode`

[models.ts:419-449](../../lib/db/models.ts#L419-L449)

Redemption codes (printed on Amazing Race cards) that grant power-ups in Unmasked.

| Field | Type | Notes |
|---|---|---|
| `sessionId` | ObjectId → Session, required, indexed | Codes are scoped to a session |
| `code` | String, required, **uppercase**, trimmed | The redemption code |
| `powerUpType` | enum `UNMASKED_POWER_UP_ENUM`, required | What the code grants |
| `scope` | enum `"universal" \| "per_team"`, default `"universal"` | Universal = anyone with the code; per_team = locked to one team |
| `teamId` | ObjectId → Team, default null | Only meaningful when `scope === "per_team"` |
| `redeemedBy` | `[ObjectId → Team]`, default `[]` | Who has redeemed this code |

Timestamps: yes.

**Index:** `{ sessionId: 1, code: 1 }` **unique compound** ([models.ts:449](../../lib/db/models.ts#L449)).

**Dev HMR reset:** Same as `UnmaskedState` — re-registered in development to refresh the `powerUpType` enum ([models.ts:482-484](../../lib/db/models.ts#L482-L484)).

---

## `PowerUpType` & `UNMASKED_POWER_UP_ENUM`

[models.ts:78-101](../../lib/db/models.ts#L78-L101)

These two **must stay in sync** — the union type is what TypeScript checks, the array is what Mongoose validates against.

```ts
export type PowerUpType =
  | "extra_heart" | "reveal" | "scout" | "shield"
  | "safe_opening" | "truth_radar" | "lie_pin"
  | "verse_compass" | "gentle_step";

export const UNMASKED_POWER_UP_ENUM: PowerUpType[] = [
  "extra_heart", "reveal", "scout", "shield",
  "safe_opening", "truth_radar", "lie_pin",
  "verse_compass", "gentle_step",
];
```

To add a new type, see [unmasked/recipes.md](../unmasked/recipes.md). Both updates land in `models.ts` plus copy in [lib/ui/powerup-copy.ts](../../lib/ui/powerup-copy.ts) and engine logic in [lib/games/unmasked/engine.ts](../../lib/games/unmasked/engine.ts).
