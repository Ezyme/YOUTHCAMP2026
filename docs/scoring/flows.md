# scoring — flows

## Result write flow (placement mode)

```mermaid
sequenceDiagram
  actor Admin
  participant Panel as <ScoringPanel>
  participant API as POST /api/game-results
  participant Pts as lib/scoring/points.ts
  participant DB as MongoDB

  Admin->>Panel: enter 1st–6th for game
  Panel->>API: { sessionId, gameId, results: [{teamId, placement}, ...] }
  API->>DB: GameDefinition.findById
  API->>Pts: validatePlacementSet (count, no gaps, no dups)
  alt invalid
    Pts-->>API: {ok:false, error}
    API-->>Panel: 400
  end
  loop each entry
    API->>Pts: pointsForPlacement(scoring, placement)
    Pts-->>API: weighted points (rounded int)
  end
  API->>DB: GameResult.bulkWrite (upsert by tuple)
  API->>DB: GameResult.find({sessionId, gameId})
  API-->>Panel: 200 saved rows
```

## Result write flow (manual mode)

```mermaid
sequenceDiagram
  actor Admin
  participant Panel as <ScoringPanel>
  participant API as POST /api/game-results
  participant Pts as lib/scoring/points.ts
  participant DB as MongoDB

  Admin->>Panel: enter per-team scores
  Panel->>API: { sessionId, gameId, results: [{teamId, points}, ...] }
  API->>Pts: clampManualPoints per row
  API->>Pts: validateManualPointsSet (count, in [0, max], no dups)
  API->>DB: Team.find({sessionId}) sorted by sortOrder
  API->>API: derive placement: rank by points desc, sortOrder tiebreak
  API->>DB: GameResult.bulkWrite (upsert by tuple, with derived placement + clamped points)
  API->>DB: GameResult.find
  API-->>Panel: 200 saved rows
```

## Leaderboard read flow

```mermaid
sequenceDiagram
  actor Visitor
  participant Page as /leaderboard (SSR)
  participant Totals as getLeaderboard
  participant DB as MongoDB

  Visitor->>Page: GET /leaderboard
  Page->>DB: Session.findOne (latest)
  Page->>Totals: getLeaderboard(sessionId)
  Totals->>DB: Team.find({sessionId}) sorted
  Totals->>DB: GameResult.find({sessionId})
  Totals->>Totals: sum pointsAwarded per team
  Totals->>Totals: compute behindLeader = max - this team
  Totals->>Totals: sort desc by total
  Totals-->>Page: LeaderboardRow[]
  Page->>Page: render <LeaderboardBreakdown> per team (SSR fetches per-team breakdown via getTeamBreakdown)
  Page-->>Visitor: HTML
```

`<LeaderboardBreakdown>` is itself a server component. It calls `getTeamBreakdown(sessionId, teamId)` to get per-game rows, then renders an accordion. The first paint includes all teams' breakdowns.

## Comeback compute flow

```mermaid
sequenceDiagram
  actor User
  participant Dashboard as /camp (SSR)
  participant Comeback as getComebackAnalytics
  participant DB as MongoDB

  User->>Dashboard: GET /camp
  Dashboard->>Comeback: getComebackAnalytics(sessionId, teamId)
  Comeback->>DB: Team.find({sessionId})
  Comeback->>DB: GameDefinition.find sorted by day, order
  Comeback->>Comeback: filter weighted (weight > 0)
  Comeback->>DB: GameResult.find({sessionId})
  Comeback->>Comeback: bucket results by gameId, sum totals per team
  Comeback->>Comeback: sort teams desc by total
  Comeback->>Comeback: rank, gapToLeader, teamAbove/Below
  Comeback->>Comeback: per-game: scoringCaps, completed?, yourPlacement, yourPoints
  Comeback->>Comeback: sumMaxRemaining, sumMinRemaining (open games only)
  Comeback->>Comeback: yourBestPossibleTotal, leaderPessimisticTotal
  Comeback->>Comeback: comebackStillPossible verdict
  Comeback->>Comeback: pointsToPassNext, pointsToEscapeLast
  Comeback-->>Dashboard: ComebackAnalytics
  Dashboard->>Dashboard: render <CampDashboard initial=...>
```

After this, the team picker on the dashboard re-fetches via `GET /api/camp/analytics`. Same function, different transport.

## "Comeback still possible" verdict logic

```ts
if (yourBestPossibleTotal > leaderPessimisticTotal) {
  // "If you take 1st in every remaining game and the leader slips, a comeback is still mathematically possible."
} else if (yourBestPossibleTotal <= leaderCurrent) {
  // "Catching the current leader would require extra scoring opportunities — aim to climb and avoid last place."
} else {
  // "Focus on the next game — every placement still matters." (default)
}
```

Read closely: `leaderPessimisticTotal` = `leaderCurrent + leaderRemainingMin`. The "still possible" verdict requires beating the leader's *worst-case* finish in remaining games — a higher bar than just "yourBestPossibleTotal > leaderCurrent".
