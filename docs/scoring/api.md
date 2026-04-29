# scoring — api

## `GET /api/leaderboard`

[Source](../../app/api/leaderboard/route.ts)

Two modes determined by query params.

### Auth: public.

### Mode 1: leaderboard rollup
Query: `sessionId` only.

```http
GET /api/leaderboard?sessionId=507f1f77bcf86cd799439011
```

#### Response 200
```json
{
  "leaderboard": [
    { "teamId": "...", "teamName": "Team 1", "color": "#ef4444",
      "totalPoints": 87, "behindLeader": 0 },
    { "teamId": "...", "teamName": "Team 2", "color": "#f97316",
      "totalPoints": 75, "behindLeader": 12 },
    /* ... */
  ]
}
```

Sorted desc by `totalPoints`. Always includes every team in the session.

### Mode 2: per-team breakdown
Query: `sessionId` + `teamId`.

```http
GET /api/leaderboard?sessionId=...&teamId=...
```

#### Response 200
```json
{
  "breakdown": [
    {
      "gameId": "...", "gameName": "Salbabida Race", "slug": "salbabida-race",
      "day": 1, "category": "Pool games",
      "placement": 2, "pointsAwarded": 4,
      "placementPointsRow": [20, 18, 16, 15, 14, 13],
      "weight": 0.2083, "scoringMode": "placement_points",
      "basePlacementPoints": 18
    },
    /* ... sorted by day then gameName alphabetical */
  ]
}
```

### Errors

| Status | Body |
|---|---|
| 400 | `{ error: "sessionId required" }` |
| 500 | `{ error }` |

---

## Other relevant routes (owned by other domains)

| Route | Owned by | Purpose |
|---|---|---|
| `POST /api/game-results` | [games-shared](../games-shared/api.md) | Upsert placements / manual scores; uses `lib/scoring/points.ts` |
| `GET /api/game-results?sessionId&gameId` | [games-shared](../games-shared/api.md) | Read existing results for one game |
| `GET /api/camp/analytics?sessionId&teamId` | [analytics](../analytics/api.md) | Wraps `getComebackAnalytics` |

The scoring domain only owns `GET /api/leaderboard`. The rest is intentionally distributed — each domain handles its own write surface.
