# scoring — backend

## `lib/scoring/points.ts`

[Source](../../lib/scoring/points.ts). Pure functions, no DB.

### `clampManualPoints(raw, max): number`
Clamps to `[0, max]`, rounds to 2 decimal places via `Math.round(n * 100) / 100`. Returns `0` for NaN.

### `validateManualPointsSet(entries, expectedCount, maxPoints)`
Returns `{ ok: true } | { ok: false, error: string }`. Verifies:
- entry count === expected (typically 6)
- no duplicate teamId
- each `points` is a number in `[0, maxPoints]`

### `pointsForPlacement(scoring, placement): number`
`placement` is 1-based. Returns `round(placementPoints[placement-1] * (scoring.weight ?? 1))`.

Throws `Error("Invalid placement N; expected 1–6")` if out of range.

### `validatePlacementSet(entries, maxPlacements)`
Returns `{ ok: true } | { ok: false, error }`. Verifies:
- entry count === maxPlacements
- placements are exactly `1..maxPlacements` with no gaps or duplicates

## `lib/scoring/totals.ts`

[Source](../../lib/scoring/totals.ts). DB-aware.

### `getLeaderboard(sessionId): Promise<LeaderboardRow[]>`

Sums `pointsAwarded` per team. Returns rows sorted desc by `totalPoints`, with `behindLeader` set to `max - this.totalPoints`. Always includes every team in the session, even if they have 0 results (totalPoints = 0).

### `getTeamBreakdown(sessionId, teamId): Promise<ScoreBreakdownRow[]>`

For each `GameResult` of this team:
- Looks up the matching `GameDefinition` (skipped if missing).
- Builds a row with: `gameId, gameName, slug, day, category, placement, pointsAwarded, placementPointsRow (clone), weight, scoringMode, basePlacementPoints?, manualPointsMax?`.
- `basePlacementPoints` is `placementPoints[placement-1]` for non-manual modes; `undefined` for manual or out-of-range placements.

Sorted by `day` then `gameName` alphabetical.

### Types

```ts
type LeaderboardRow = { teamId, teamName, color, totalPoints, behindLeader };
type ScoreBreakdownRow = {
  gameId, gameName, slug, day, category,
  placement, pointsAwarded,
  placementPointsRow: number[],
  weight, scoringMode,
  basePlacementPoints?, manualPointsMax?
};
```

## `lib/scoring/comeback.ts`

[Source](../../lib/scoring/comeback.ts). DB-aware. The "comeback math" engine.

### `getComebackAnalytics(sessionId, teamId): Promise<ComebackAnalytics | null>`

Returns null if no teams. Otherwise builds the full analytics. See [architecture.md](./architecture.md#comeback-analytics) and [flows.md](./flows.md#comeback-compute-flow) for behavior detail.

### Helpers

- `scoringCaps(sc)` — `{ max: round(max(placementPoints) * weight), min: round(min(...) * weight) }`. For `manual_points` games, the "max" is somewhat misleading (real cap is `manualPointsMax`, not weighted placement) — see [gotchas.md](./gotchas.md).
- `isGameComplete(teamCount, resultsForGame)` — `teamCount > 0 && resultsForGame >= teamCount`.

The "weighted games" set is `weight > 0` — Mindgame and Unmasked are excluded.

## `lib/scoring/comeback.types.ts`

[Source](../../lib/scoring/comeback.types.ts). Pure types, no `mongoose` import. Imported by client components (`<CampDashboard>`, `estimate-placement.ts`).

If you add a field to `ComebackAnalytics`, add it here AND update `getComebackAnalytics` to populate it. The types are shared between server and client.

## `lib/scoring/estimate-placement.ts`

[Source](../../lib/scoring/estimate-placement.ts). Tiny helper:

```ts
estimateAvgPlacementToClose(gapPoints, remainingGames): string
```

Rough heuristic: divides the gap by the sum of (max-min) spreads across open games, derives an average placement (1 = best, 6 = worst), returns a string like `~3.4 avg. place (rough)`. Returns `"—"` when the gap is closed or no open games.

This is a **heuristic** — it doesn't account for weights, doesn't model leader behavior, doesn't cover discontinuous scoring rows. Decorative, not authoritative.

## `lib/admin/plain-game-scoring.ts`

[Source](../../lib/admin/plain-game-scoring.ts). Already covered in [architecture.md](./architecture.md#plain-game-scoring-shim) and [admin/backend.md](../admin/backend.md). Strips Mongoose subdoc internals so `GameDefinition.scoring` can pass to client components.

## `/api/leaderboard` route

See [api.md](./api.md). Single GET endpoint. Two query patterns:
- `?sessionId=...` → `{ leaderboard: LeaderboardRow[] }`
- `?sessionId=...&teamId=...` → `{ breakdown: ScoreBreakdownRow[] }`

The route is a thin wrapper around `getLeaderboard` / `getTeamBreakdown`.

## What this domain does NOT own

- `POST /api/game-results` — owned by [games-shared](../games-shared/api.md). Calls into `points.ts`.
- `GET /api/camp/analytics` — owned by [analytics](../analytics/api.md). Calls `getComebackAnalytics`.
- The seed's point-row constants (`ROW_LIGHT`, `ROW_HEAVY`, `AMAZING_RACE_POINTS`) — owned by [seed](../seed/architecture.md).
