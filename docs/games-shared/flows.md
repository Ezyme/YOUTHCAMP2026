# games-shared — flows

## /games visibility flow

```mermaid
flowchart TD
  Req[GET /games] --> Auth[loadCampTeamScoredGames]
  Auth --> NoSession{No Session?}
  NoSession -->|yes| Empty[Render run-seed message]
  NoSession -->|no| HasTeamCookie{youthcamp_team_id valid?}
  HasTeamCookie -->|no| RedirLogin["/login?next=/games"]
  HasTeamCookie -->|yes| LoadGames[Load all GameDefinitions]
  LoadGames --> Filter[Filter day > 0 AND scored by team]
  Filter --> ShowList[Render Day 1 / Day 2 sections]
  Filter -->|empty| Promote[Show /play/unmasked + /play/mindgame promo]
```

`scoredGameIds` is the set of `GameResult.gameId` values for `(sessionId, teamId)`. A game enters the list only after the facilitator publishes a result for that team.

## /games/[slug] flow

```mermaid
flowchart TD
  Req[GET /games/:slug] --> Find[GameDefinition.findOne by slug]
  Find -->|missing| NF[notFound]
  Find -->|day === 0| NF
  Find -->|isPlayable| RequireTeam[requireCampTeamForGameRoute]
  Find -->|not playable| RequireTeam2[requireCampTeamForGameRoute]
  RequireTeam2 --> CheckResult{teamHasGameResult?}
  CheckResult -->|no| NF
  CheckResult -->|yes| Render
  RequireTeam --> Render[Render rules + scoring + Play button]
```

Playable games (`mindgame`, `unmasked`) skip the result check. Non-playable games (manually-judged) require a published score before the team can see scoring details — same scoreboard-reveal UX as `/games`.

## /play/[gameSlug] flow

```mermaid
sequenceDiagram
  actor User
  participant Page as /play/[gameSlug] (SSR)
  participant Seed as ensureGameDefinitionBySlug
  participant DB as MongoDB
  participant Board as <MindgameBoard /> or <UnmaskedBoard />

  User->>Page: GET /play/unmasked
  Page->>DB: GameDefinition.findOne({slug})
  alt missing
    Page->>Seed: ensure(slug)
    Seed->>DB: upsert from CAMP_GAMES
  end
  Page->>DB: latest Session
  Page->>Page: read youthcamp_team_id cookie
  alt no team cookie
    Page-->>User: redirect /login?next=/play/...
  end
  Page->>DB: Team.findById to get name
  Page->>Board: render with sessionId, teamId, slug, label
  Board-->>User: client-side fetches /api/<engine>/state
```

## Game result upsert flow (placement)

```mermaid
sequenceDiagram
  participant Admin as /admin/scoring (ScoringPanel)
  participant API as POST /api/game-results
  participant Pts as lib/scoring/points
  participant DB as MongoDB

  Admin->>API: { sessionId, gameId, results: [{teamId, placement}, ...] }
  API->>DB: GameDefinition.findById
  API->>Pts: validatePlacementSet (1..6 unique)
  Pts-->>API: { ok: true }
  API->>Pts: pointsForPlacement(scoring, placement) per row
  API->>DB: GameResult.bulkWrite (upsert per teamId)
  API->>DB: GameResult.find for the saved rows
  API-->>Admin: 200 saved rows
```

For `manual_points` mode, `clampManualPoints` rounds + bounds, then `validateManualPointsSet` verifies all 6 teams are present and unique. Placements are derived by ranking points (with sortOrder tiebreak) before write.

See [scoring/flows.md](../scoring/flows.md) for deeper detail.
