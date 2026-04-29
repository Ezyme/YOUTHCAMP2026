# scoring — Placement points, weights, comeback math

The /100 camp rubric, computed per `(session, team, game)` and rolled up for the leaderboard. Also computes "comeback analytics" (gap to leader, points to pass next, best-possible total).

## What lives in this folder

- [lib/scoring/points.ts](../../lib/scoring/points.ts) — placement validation, manual-points clamp, weighted point calc.
- [lib/scoring/totals.ts](../../lib/scoring/totals.ts) — leaderboard rollup + per-team breakdown.
- [lib/scoring/comeback.ts](../../lib/scoring/comeback.ts) — gap-to-leader analytics for the camp dashboard.
- [lib/scoring/comeback.types.ts](../../lib/scoring/comeback.types.ts) — client-safe types (no DB imports).
- [lib/scoring/estimate-placement.ts](../../lib/scoring/estimate-placement.ts) — heuristic "avg placement to close gap" string.
- [lib/admin/plain-game-scoring.ts](../../lib/admin/plain-game-scoring.ts) — strip Mongoose internals for client props.
- [app/api/leaderboard/route.ts](../../app/api/leaderboard/route.ts) — `GET /api/leaderboard`.
- [app/leaderboard/page.tsx](../../app/leaderboard/page.tsx) — public leaderboard.
- [components/leaderboard-breakdown.tsx](../../components/leaderboard-breakdown.tsx) — accordion per-team breakdown.
- [components/admin/scoring-panel.tsx](../../components/admin/scoring-panel.tsx) — admin entry form.
- [app/admin/(panel)/scoring/page.tsx](../../app/admin/(panel)/scoring/page.tsx) — admin SSR.

## Docs in this folder

| File | What it covers |
|---|---|
| [architecture.md](./architecture.md) | The /100 rubric, scoring modes, weight semantics, comeback math |
| [models.md](./models.md) | `GameResult` + `GameDefinition.scoring` field reference |
| [flows.md](./flows.md) | Result write flow, leaderboard read flow, comeback compute flow |
| [frontend.md](./frontend.md) | `/leaderboard`, `<LeaderboardBreakdown>`, `<ScoringPanel>` |
| [backend.md](./backend.md) | `points.ts`, `totals.ts`, `comeback.ts` function reference |
| [api.md](./api.md) | `GET /api/leaderboard` (only domain-specific route; `/api/game-results` lives in games-shared) |
| [rules.md](./rules.md) | Always validate placements, always weight, always upsert by tuple |
| [patterns.md](./patterns.md) | Validate-then-write, scoringMode dispatch, plain-game-scoring shim |
| [recipes.md](./recipes.md) | Add a scoring mode, change point rows, change camp rubric |
| [gotchas.md](./gotchas.md) | Manual-points placement is for ordering, weight 0 hides games, orphan results |

## Related domains

- [games-shared](../games-shared/README.md) — owns `GameDefinition` CRUD and `POST /api/game-results`.
- [seed](../seed/README.md) — defines initial point rows + weights in `lib/seed/camp-games.ts`.
- [admin](../admin/README.md) — `<ScoringPanel>` is the entry surface.
- [analytics](../analytics/README.md) — `/api/camp/analytics` wraps `getComebackAnalytics`.
- [db](../db/README.md) — `GameResult` and `GameDefinition` schemas.
