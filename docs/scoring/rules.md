# scoring — rules

## MUST

- **Always validate placements via `validatePlacementSet`** before computing points. The validator rejects gaps, duplicates, wrong counts.
- **Always validate manual scores via `validateManualPointsSet`** + clamp via `clampManualPoints`. Manual scores need bounds and uniqueness checks.
- **Always compute weighted points via `pointsForPlacement(scoring, placement)`.** Reading `placementPoints[idx]` directly skips the weight multiplier and breaks the leaderboard.
- **Always upsert `GameResult` by the unique tuple `(sessionId, gameId, teamId)`.** `bulkWrite` with `upsert: true` is the canonical pattern. Anything else risks duplicate rows.
- **Always strip subdoc internals via `plainGameScoring()`** when passing `GameDefinition.scoring` to a client component.
- **Always treat `weight: 0` as "excluded from total".** Both `getLeaderboard` and `getComebackAnalytics` handle this — but if you write a new aggregator, mirror the behavior or you'll show Mindgame/Unmasked in totals.
- **Always store `pointsAwarded` as the **already-weighted** value.** Reads sum without re-multiplying.
- **Always validate placement is `1..maxPlacements`** (typically 6). `pointsForPlacement` throws on out-of-range; the validator catches it earlier.
- **Always include `placementPoints` (length 6) in every `GameDefinition`** — even for `manual_points` games. The schema validator enforces it.

## MUST NOT

- **Never bypass `lib/scoring/points.ts`** in `/api/game-results`. The handler must delegate computation, not inline math.
- **Never let `manual_points` write skip the placement field.** The schema requires `placement: 1..6`. The route derives it by ranking points + sortOrder tiebreak. Don't store `placement: null` or `0`.
- **Never re-compute `pointsAwarded` on read.** Stored value is canonical. Re-multiplying by current weight would shift past results when admin tweaks settings — trust history.
- **Never delete a `GameDefinition` while expecting `GameResult` cascade.** It doesn't cascade. Orphan rows linger; the leaderboard breakdown filters them out (via `gameMap.get`), but they're still in the DB.
- **Never let `getTeamBreakdown` query without a session/team filter.** `find({ sessionId, teamId })` is the only safe pattern.
- **Never expose `getLeaderboard` to a session not the caller's** — well, today it's public, but if you ever add per-session privacy, add it explicitly. The route doesn't auth-check.
- **Never round `clampManualPoints` to fewer than 2 decimal places.** Judges enter scores like `8.5` and that fractional precision matters for tie-breaking.
- **Never store `pointsAwarded` as a non-integer for placement modes.** `pointsForPlacement` rounds via `Math.round(base * weight)`. Manual mode keeps 2 decimals; placement mode is integer.
- **Never assume `weight === 1` for any game.** Always read from `GameDefinition.scoring.weight`. Defaults exist but admin can override.
