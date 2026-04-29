# unmasked — models

Three things in `lib/db/models.ts` belong to this domain. Full field reference in [db/models.md](../db/models.md). This file calls out the unmasked-specific concerns.

## `PowerUpType` union & `UNMASKED_POWER_UP_ENUM` array

[models.ts:78-101](../../lib/db/models.ts#L78-L101)

```ts
export type PowerUpType =
  | "extra_heart" | "reveal" | "scout" | "shield"
  | "safe_opening" | "truth_radar" | "lie_pin"
  | "verse_compass" | "gentle_step";

export const UNMASKED_POWER_UP_ENUM: PowerUpType[] = [ /* same 9 strings */ ];
```

These two **must stay in sync**. Both `UnmaskedState.powerUps[].type` and `PowerUpCode.powerUpType` validate against `UNMASKED_POWER_UP_ENUM`.

To add a power-up, see [recipes.md](./recipes.md#recipe-add-a-new-power-up). Adding to one but not the other lets TypeScript pass while Mongoose validation rejects inserts at runtime.

## `UnmaskedState`

[models.ts:350-415](../../lib/db/models.ts#L350-L415). Largest schema in the project.

### Index

`{ sessionId: 1, teamId: 1 }` — **unique compound** ([models.ts:417](../../lib/db/models.ts#L417)). One Unmasked save per team per session.

### Critical fields

| Field | Notes |
|---|---|
| `seed`, `gridSize`, `totalLies` | Define the deterministic board layout |
| `verseKeys` | Pool on this board (e.g. `["psalm139_14", "1peter2_9", "ephesians2_10", "isaiah43_1"]`) |
| `verseFragments` | `[{ index, text, order, verseKey }]` — placed on board tiles |
| `verseAssemblyIndices` | Tile indices currently in the builder row (subset of `verseFragments[].index`) |
| `versesRestored` | Verse keys correctly assembled |
| `versesGivenUp` | Verse keys forfeited after max failed checks (no score) |
| `verseCheckAttemptsByKey` | `{ verseKey: number }` — wrong-check counter per verse |
| `verseScore` | Sum of fragment counts of restored verses |
| `redeemedCodes` | Codes already redeemed (uppercase) |
| `powerUps` | Inventory: `[{ type, used }]`, validated against `UNMASKED_POWER_UP_ENUM` |
| `shielded` | Active shield (auto-applied from `shield` redemption) |
| `status` | `"playing" | "won" | "lost"` |
| `liesHit`, `hearts`, `maxHearts` | Heart bookkeeping |
| `startedAt`, `lastPlayActivityAt`, `finishedAt`, `submittedAt` | Timestamps |
| `passagesComplete` | All verses on board restored |
| `checkPassagePenaltySeconds` | Sum of penalty seconds (30s per wrong check) |

### Deprecated fields (still in schema)

| Field | Replaced by |
|---|---|
| `verseKey` (single) | `verseKeys[]` |
| `verseAssembly` | `verseAssemblyIndices` |
| `verseCompleted` | `versesRestored[]` |
| `finalScore` | (removed from play; legacy) |
| `scoreBreakdown` | (kept for legacy reads) |

Don't remove these — `migrateLegacyUnmaskedState` reads them and writes the new fields. After verifying no live document has only legacy fields, you can drop them. Today, they're load-bearing for old saves.

### Subdocument: `powerUps`

```ts
const UnmaskedPowerUpEntrySchema = new Schema(
  { type: { type: String, required: true, enum: UNMASKED_POWER_UP_ENUM },
    used: { type: Boolean, default: false } },
  { _id: false }
);
```

`_id: false` saves bytes per inventory entry. The outer field name `type` is the power-up kind; the inner `type: String` is the Mongoose field type — confusing but correct.

### Dev-HMR delete guard

```ts
if (process.env.NODE_ENV === "development" && mongoose.models.UnmaskedState) {
  delete mongoose.models.UnmaskedState;
}
```

[models.ts:472](../../lib/db/models.ts#L472). Required for the enum to refresh when you add a new `PowerUpType` mid-development. See [db/gotchas.md](../db/gotchas.md).

## `PowerUpCode`

[models.ts:419-449](../../lib/db/models.ts#L419-L449). Redemption codes printed at Amazing Race stations.

### Index

`{ sessionId: 1, code: 1 }` — **unique compound** ([models.ts:449](../../lib/db/models.ts#L449)).

### Fields

| Field | Notes |
|---|---|
| `sessionId` | Codes scoped to a session |
| `code` | Always uppercase, trimmed |
| `powerUpType` | Validated against `UNMASKED_POWER_UP_ENUM` |
| `scope` | `"universal"` (any team) or `"per_team"` (locked to `teamId`) |
| `teamId` | Required when `scope === "per_team"` |
| `redeemedBy` | `[ObjectId]` of teams that have redeemed |

### Dev-HMR delete guard

[models.ts:482](../../lib/db/models.ts#L482) — same as `UnmaskedState`.

### Cascade behavior on reset

`/api/admin/reset-camp` does NOT delete `PowerUpCode` rows. Only `redeemedBy` is cleared (`$set: {redeemedBy: []}`). Codes stay valid for the next camp run. See [admin/api.md](../admin/api.md).

## What's NOT a model

- Verse texts — code constants in [`lib/games/unmasked/verses.ts`](../../lib/games/unmasked/verses.ts), not DB rows.
- Lie texts — also code constants ([engine.ts:56-77](../../lib/games/unmasked/engine.ts#L56-L77)).
- Power-up copy strings — code constants in [`lib/ui/powerup-copy.ts`](../../lib/ui/powerup-copy.ts).

These are static enough to live in code; admin doesn't edit them.
