# scoring — frontend

## `/leaderboard` — [app/leaderboard/page.tsx](../../app/leaderboard/page.tsx)

Server component, `dynamic = "force-dynamic"`. Loads latest session + `getLeaderboard(sessionId)`. Renders one `<LeaderboardBreakdown>` per team. Public — no auth check.

Header copy summarizes the /100 rubric. The breakdown explains the math per row.

## `<LeaderboardBreakdown>` — [components/leaderboard-breakdown.tsx](../../components/leaderboard-breakdown.tsx)

**Server component** that uses `<details>` for client-free expand/collapse. Calls `getTeamBreakdown(sessionId, teamId)` directly inside the component — that's why the page is `dynamic`. Each team's breakdown is fetched server-side on first render.

UI:
- Collapsed: rank badge, color dot, team name, total points, "behind leader" diff.
- Expanded: per-game card showing day, category, game name, points awarded, and the math:
  - Race-style: `<placement> place: base value <X> × event weight <pct>% → <Y> pts`
  - Manual: `<Y> pts from judges (max <max> on the /100 camp total). Sorted by score, this team is <ordinal> — that rank is for ordering only…`

The `formatWeightPct` helper converts `weight === 1` to `"100%"` and others to `<pct>%`.

`placementScaleLegend(row)` shows `"1st 12 · 2nd 11 · 3rd 10 · …"` for the placement scale.

## `<ScoringPanel>` — [components/admin/scoring-panel.tsx](../../components/admin/scoring-panel.tsx)

Client. Renders one section per game. Fetches existing `GameResult` rows via `GET /api/game-results?sessionId&gameId` on mount. Form differs by mode:

- **Placement modes**: dropdown 1–6 per team (or vice versa). Validation enforces all-six-unique before submit.
- **Manual mode**: number input per team, bounded `[0, manualPointsMax]`. Decimal allowed.

POSTs to `/api/game-results`. On success, refetches rows and shows a success toast.

The page passes `gamesForClient` cleansed via `plainGameScoring`:

```ts
gamesForClient = games.map(g => ({
  _id: String(g._id),
  name: g.name,
  slug: g.slug,
  scoring: plainGameScoring(g.scoring),
}));
```

Without that strip, React would refuse to serialize `g.scoring` (Mongoose subdoc internals).

## `<CampDashboard>` (in [components/camp/](../../components/camp/))

The team-picker dashboard — see [camp-auth/frontend.md](../camp-auth/frontend.md). Consumes `ComebackAnalytics` from this domain. Computes `estimateAvgPlacementToClose(gap, openGames)` for the "what placement do I need" hint string (rough heuristic, see [estimate-placement.ts](../../lib/scoring/estimate-placement.ts)).

## Public-facing UI does NOT show

- The placement-vs-points formula explicitly. The breakdown text shows the math but the page header doesn't.
- Predicted totals or leaderboard projections.
- Per-game timestamp / chronological ordering. The breakdown sorts by `day` then `gameName` alphabetically.
