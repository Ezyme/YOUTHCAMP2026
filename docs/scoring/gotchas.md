# scoring — gotchas

## 1. Weight changes don't shift past results

`pointsAwarded` is computed at write time. Past results stick to the weight they were saved with. Mid-camp weight tweaks affect only new entries.

Pros: predictable, no retroactive surprises. Cons: if you realize a weight was wrong, you need to delete + re-enter past results to fix the leaderboard.

There's no UI for "recompute all results with current weights". See [recipes.md](./recipes.md#recipe-re-apply-weights-to-existing-results) for a manual script.

## 2. `placement` for `manual_points` is rank-by-score, not points-source

For `manual_points` games, `placement` exists for the unique compound index (`(sessionId, gameId, teamId)` + the schema requires `placement: 1..6`) and for ordering UI. It is **not** used to compute `pointsAwarded` — that's just `clampManualPoints(input)`.

If a future UI accidentally uses `pointsForPlacement(scoring, placement)` for a `manual_points` game, you'll get a placement-row-derived value instead of the judge-entered score. Bug. The `BreakdownRowDetail` component handles this correctly by branching on `scoringMode`.

## 3. Tied points → `sortOrder` tiebreak

For `manual_points` placement derivation:
```ts
ranked.sort((a, b) => {
  if (b.points !== a.points) return b.points - a.points;
  return (orderIdx.get(a.teamId) ?? 0) - (orderIdx.get(b.teamId) ?? 0);
});
```

Two teams with the same score get adjacent placements (1st and 2nd, never both 1st). Lower `sortOrder` wins the better placement. If admins tweak `sortOrder` mid-camp, this shifts existing tied results' `placement` field on next save (but `pointsAwarded` is unchanged, so leaderboard total doesn't move).

## 4. Leaderboard ties have no tiebreaker

`getLeaderboard` sorts purely by `totalPoints` desc. Tied teams share a rank visually (both appear at "rank 3" in the UI's iteration index, but they appear in an arbitrary order from Mongo). The displayed rank in `<LeaderboardBreakdown>` is the iteration index — tied teams will see different rank numbers despite identical scores.

Add a tiebreaker if camp UX needs it. See [recipes.md](./recipes.md#recipe-add-a-tiebreaker-to-the-leaderboard-sort).

## 5. `scoringCaps` for `manual_points` is not the actual cap

```ts
function scoringCaps(sc: GameScoring): { max: number; min: number } {
  const pts = sc.placementPoints;
  const w = sc.weight ?? 1;
  return { max: round(max(pts) * w), min: round(min(pts) * w) };
}
```

For a `manual_points` game with `placementPoints: [12, 11, 10, 9, 8, 7]`, `weight: 1`, `manualPointsMax: 5`, `scoringCaps` returns `{ max: 12, min: 7 }` — but the real bounds for that game are `[0, 5]`. Comeback's `sumMaxRemaining` over-counts by ~7-12 per remaining manual-points game.

In practice the seeded `manual_points` games have weight 1 and `placementPoints` whose sum ≈ 60 — close enough to the rubric pillar caps (5/10/10/20) that the over-count is small. But it's a real source of "we said comeback is possible and it's actually not".

To fix properly: branch in `scoringCaps` by mode, return `{max: manualPointsMax, min: 0}` for manual mode.

## 6. Orphan `GameResult` rows survive game deletion

Deleting a `GameDefinition` does NOT cascade. The orphan `GameResult` rows still match `find({ sessionId })` queries. `getLeaderboard` sums them (the sum is small — usually 0 — but technically the points carry).

`getTeamBreakdown` filters them via `gameMap.get(gameId)` so they don't appear in the breakdown UI. But they'd still affect `totalPoints` in the leaderboard.

If you delete games mid-camp, also `deleteMany({ gameId })` on `GameResult`. Or accept the silent inflation.

## 7. `placementPoints` length validator runs on insert/update — not on read

If a legacy document somehow has `placementPoints.length !== 6`, reads succeed but `getTeamBreakdown` will produce a row with the placementPointsRow as-is (including extra entries). The leaderboard breakdown table just renders them. Mostly harmless — but if `pointsForPlacement` is called with `placement === 7` on a 7-entry array, it returns `placementPoints[6] * weight` instead of throwing.

## 8. `getLeaderboard` includes every team, even with 0 results

Teams that haven't been scored yet appear with `totalPoints: 0`. The `behindLeader` is `max - 0 = max`. UX is fine — but a fresh camp shows the leaderboard already populated, which can confuse first-time users.

## 9. `getTeamBreakdown` sorts by day then game name alphabetically

Not by completion order, not by points. So a Day 1 game scored on Day 2 still appears under Day 1. This is the intended chronological-display behavior.

If you want completion-order, sort by `r.completedAt` desc — but `completedAt` is optional and many entries don't set it.

## 10. The `floatingPoint` for `pointsAwarded` (manual mode)

`clampManualPoints` rounds to 2 decimals: `Math.round(c * 100) / 100`. So `pointsAwarded: 8.5` is fine, `pointsAwarded: 8.55` is fine, but `pointsAwarded: 8.555` would be saved as `8.56` (round-half-up via `Math.round`). Judges entering `7 + 1/3 = 7.333…` would see `7.33` saved.

Acceptable for camp — judges enter in 0.5 increments.

## 11. `clampManualPoints` doesn't handle negative `max`

If a future code path passes a negative `max` (probably a bug elsewhere), the clamp returns `Math.min(max, ...)` which would clamp positive entries to negative. Use defensively: `Math.max(0, max)` before passing.

## 12. Comeback compute reads ALL `GameResult` for the session

`getComebackAnalytics` loads every result for the session in one query. Fine for ~6 teams × ~14 games = 84 rows. For a 100-team / 50-game scenario, it's still cheap (5000 rows, all small). But if you scale up, consider an aggregation pipeline.

## 13. The `comebackStillPossible` text comparison uses pessimistic leader

```ts
if (yourBestPossibleTotal > leaderPessimisticTotal) { /* still possible */ }
else if (yourBestPossibleTotal <= leaderCurrent) { /* impossible */ }
else { /* default */ }
```

The middle case (`leaderCurrent < yourBest <= leaderPessimisticTotal`) shows the **default** "every placement still matters" text — even though catching the leader requires them to underperform. The wording is honest but the threshold for the optimistic verdict is high. Don't try to "fix" by lowering — it's deliberately conservative.
