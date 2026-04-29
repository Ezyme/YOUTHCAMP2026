# scoring — architecture

## The /100 rubric

The camp scores out of 100 across six pillars:

| Pillar | Weight | Notes |
|---|---|---|
| Merit (dog tags) | 5% | Manual entry, max 5/team |
| Pool + field team games (6 events) | 25% combined | Each event has a placement row + a weight that scales it |
| Amazing Race | 30% | Single overall event with finish-order placements |
| Flag (Camper's Night) | 10% | Manual entry, max 10/team |
| Cheer (Camper's Night) | 10% | Manual entry, max 10/team |
| Group skit / Presentation | 20% | Manual entry, max 20/team |

The seed in [lib/seed/camp-games.ts](../../lib/seed/camp-games.ts) configures each game's `placementPoints`, `weight`, `scoringMode`, and (for manual modes) `manualPointsMax` to satisfy this rubric. See [seed/architecture.md](../seed/architecture.md).

## Scoring modes

Four modes defined on `GameDefinition.scoring.scoringMode`:

| Mode | Use case | How `pointsAwarded` is computed |
|---|---|---|
| `placement_points` | Most race-style events | `round(placementPoints[placement-1] * weight)` |
| `amazing_race_finish` | Amazing Race overall | Same math as `placement_points`; the mode label exists for UX clarity |
| `amazing_race_first_only` | (wired but unused) Reserved for "1st only" stations | `[N, 0, 0, 0, 0, 0]` row achieves the same result |
| `manual_points` | Judge-entered scores (Merit, Flag, Cheer, Skit) | The `points` value clamped to `[0, manualPointsMax]`. Placement is derived by score ranking with `sortOrder` tiebreak — used for ordering UI only, not for points. |

`pointsForPlacement` ([points.ts:40-51](../../lib/scoring/points.ts#L40-L51)) is the single computation function for the three placement modes:

```ts
export function pointsForPlacement(scoring: GameScoring, placement: number): number {
  const idx = placement - 1;
  const base = scoring.placementPoints[idx] ?? 0;
  return Math.round(base * (scoring.weight ?? 1));
}
```

`clampManualPoints` ([points.ts:4-9](../../lib/scoring/points.ts#L4-L9)) bounds and rounds manual scores to 2 decimal places.

## Weights

`weight` is a multiplier applied to the placement row before storage. Examples from the seed:

| Game | Row | Weight | Effective row |
|---|---|---|---|
| Pingpong Ball Race | `[15,13,11,10,9,8,7]` | `25/120` | `[3.13, 2.71, 2.29, 2.08, 1.88, 1.67]` (rounded to int on save) |
| Salbabida Race | `[20,18,16,15,14,13]` | `25/120` | `[4.17, 3.75, 3.33, 3.13, 2.92, 2.71]` |
| Collect the Flags | `[20,18,16,15,14,13]` | `50/120` | `[8.33, 7.50, 6.67, 6.25, 5.83, 5.42]` (2× heavy row) |
| Amazing Race | `[30,28,26,25,24,23]` | `1` | identity |
| Mindgame, Unmasked | (defaults) | `0` | always 0 (not in total) |

The 6 team mini-games all use `25/120 = 0.2083` so their finished placements sum to ~25 if a team places 1st in every event ([seed/architecture.md](../seed/architecture.md) explains the math). Collect the Flags is the exception: `50/120 = 0.4167` so it counts twice as much, and the rubric still holds at /100.

`weight: 0` hides a game from the leaderboard total and from `getComebackAnalytics`. Used for `mindgame` and `unmasked` (Amazing Race stations are not separately scored).

## Layer position

```
[Browser] /admin/scoring (ScoringPanel) → POST /api/game-results
                                                │
                                                ▼
                                  [lib/scoring/points.ts]
                                  validate + compute weighted points
                                                │
                                                ▼
                                  [lib/db/models.ts → GameResult]
                                  bulkWrite upsert by (session, game, team)

[Browser] /leaderboard         → SSR: getLeaderboard(sessionId)
                                                │
                                                ▼
                              [lib/scoring/totals.ts]
                              roll up GameResult.pointsAwarded per team

[Browser] /camp (CampDashboard) → /api/camp/analytics?sessionId=...&teamId=...
                                                │
                                                ▼
                              [lib/scoring/comeback.ts]
                              compute gap-to-leader, best-possible-total, etc.
```

## Comeback analytics

`getComebackAnalytics(sessionId, teamId)` ([comeback.ts](../../lib/scoring/comeback.ts)) reads:
- All teams (sorted by sortOrder)
- All games with weight > 0 (the "weighted" set; see below)
- All `GameResult` rows for the session

And computes:
- `rank` (1-indexed)
- `currentPoints`, `leaderPoints`, `gapToLeader`
- `teamAbove`, `teamBelow` (one rank up / down)
- Per-game stats: `maxPointsThisGame`, `minPointsThisGame`, `yourPlacement`, `yourPoints`, `completed` (every team has a result)
- `sumMaxRemaining`, `sumMinRemaining`, `yourBestPossibleTotal`, `leaderPessimisticTotal`
- `comebackStillPossible`: a string verdict (e.g. "if you take 1st in every remaining game…")
- `pointsToPassNext` (1 + gap to next team up)
- `pointsToEscapeLast` (gap to the second-to-last team, only meaningful when in last)

A game is **completed** when `gameResults.length >= teamCount`.

A game is **weighted** when `scoring.weight > 0` — i.e. it counts toward the camp total. Mindgame and Unmasked have `weight: 0` and are excluded.

`scoringCaps(sc)` returns `{ max, min }` = `{ round(max(placementPoints) * weight), round(min(...) * weight) }`. For `manual_points` games this still works — `max(placementPoints)` is the highest entry in the seed's default array, which gives a "cap" of sorts. (Slight imprecision: for `manual_points`, the real cap is `manualPointsMax`, not `max(placementPoints) * weight`. See [gotchas.md](./gotchas.md).)

## Plain-game-scoring shim

[`lib/admin/plain-game-scoring.ts`](../../lib/admin/plain-game-scoring.ts) strips Mongoose subdoc internals (the `_id` buffer) so `GameDefinition.scoring` can cross the server→client boundary. Used by `/admin/games/[id]/edit` and `/admin/scoring`. Without it, React's structured-clone serialization throws.
