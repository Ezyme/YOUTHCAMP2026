# scoring — models

Two model surfaces matter here. Field-level details in [db/models.md](../db/models.md).

## `GameDefinition.scoring` (embedded subdoc)

[models.ts:198-225](../../lib/db/models.ts#L198-L225)

```ts
scoring: {
  maxPlacements: 6,
  scoringMode: "placement_points" | "amazing_race_finish" | "amazing_race_first_only" | "manual_points",
  placementPoints: number[6],   // exactly 6 entries (validator enforces)
  weight: number,               // multiplier; 0 = excluded from total
  manualPointsMax?: number,     // 0..100; required for manual_points
}
```

Defaults via `defaultScoring()` ([models.ts:179-184](../../lib/db/models.ts#L179-L184)): `{ 6, "placement_points", [12, 11, 10, 9, 8, 7], weight: 1 }`.

### Important

- `placementPoints` MUST have exactly 6 entries — schema validator. Even for `manual_points` games, where the row isn't used. The seed sets a default row anyway.
- `weight: 0` hides the game from leaderboard totals and from `getComebackAnalytics`.
- `manualPointsMax` is only present when `scoringMode === "manual_points"`. The schema permits it on any mode but the application only reads it for manual mode.
- Cross the server→client boundary via `plainGameScoring()` ([lib/admin/plain-game-scoring.ts](../../lib/admin/plain-game-scoring.ts)) to strip `_id` buffers.

## `GameResult`

[models.ts:316-348](../../lib/db/models.ts#L316-L348)

| Field | Type | Notes |
|---|---|---|
| `sessionId` | ObjectId → Session, required, indexed | |
| `gameId` | ObjectId → GameDefinition, required, indexed | |
| `teamId` | ObjectId → Team, required, indexed | |
| `placement` | Number, 1–6, required | For `manual_points`, this is rank-by-score (ordering only) |
| `pointsAwarded` | Number, required | Already weighted; this is what the leaderboard sums |
| `completedAt` | Date | Optional |
| `notes` | String | Free-form |
| `updateReason` | String | Free-form audit trail |

**Index:** `{ sessionId: 1, gameId: 1, teamId: 1 }` **unique compound** ([models.ts:345-348](../../lib/db/models.ts#L345-L348)). Prevents double-scoring.

`pointsAwarded` is computed at write time:
- Placement modes: `pointsForPlacement(scoring, placement)` = `round(placementPoints[placement-1] * weight)`
- Manual mode: `clampManualPoints(input, manualPointsMax)` = `round(min(max(0, n), max) * 100) / 100`

### Why store derived `pointsAwarded` instead of computing on read

Two reasons:
1. **Auditability.** If a `GameDefinition.scoring.weight` changes mid-camp (admin tweaks settings), already-saved results keep their original points. Re-applying the new weight retroactively would shift the leaderboard for past events. The current behavior preserves history.
2. **Performance.** Leaderboard reads are cheap — single sum, no per-row math.

Trade-off: changing the weight mid-camp doesn't fix already-saved rows. To re-apply, the admin would need to delete + re-enter the result. Not currently in code.

## What scoring does NOT own

- `GameDefinition` CRUD lives in [games-shared](../games-shared/README.md).
- `GameResult` writes live in `/api/game-results/route.ts` ([games-shared/api.md](../games-shared/api.md)) — the route delegates math to `lib/scoring/points.ts` but is owned by games-shared.
- `Session` and `Team` schemas — see [db/models.md](../db/models.md).
