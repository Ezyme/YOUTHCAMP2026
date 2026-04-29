# games-shared — api

## `GET /api/games`

[Source](../../app/api/games/route.ts)

List every `GameDefinition`, sorted `day` then `order`.

### Auth: public.
### Response 200: `IGameDefinition[]`.

---

## `POST /api/games`

Create a `GameDefinition`. Used by `<GameForm />` in the admin panel.

### Auth: public (no admin check today — see [admin/gotchas.md](../admin/gotchas.md)).
### Body
```json
{
  "name": "...", "slug": "...", "day": 1, "category": "...",
  "engineKey": "mindgame" | "unmasked" | "config_only",
  "settings": {...},
  "scoring": { "maxPlacements": 6, "scoringMode": "...", "placementPoints": [...], "weight": 1, "manualPointsMax": ? },
  "rulesMarkdown": "...",
  "order": 0,
  "isPlayable": true,
  "mediaUrl": "...", "mediaPublicId": "..."
}
```
### Response 200: created `IGameDefinition`.
### Errors: 500 on Mongoose validation failure (e.g. `placementPoints.length !== 6`).

---

## `GET /api/games/[id]`

[Source](../../app/api/games/[id]/route.ts)

### Auth: public.
### Path: `id` — ObjectId.
### Responses
| Status | Body |
|---|---|
| 200 | `IGameDefinition` |
| 400 | `{ error: "Invalid id" }` |
| 404 | `{ error: "Not found" }` |

---

## `PATCH /api/games/[id]`

Update arbitrary fields with `runValidators: true`.

### Auth: public.
### Body: any subset of `IGameDefinition` fields.
### Responses: 200 updated doc, 400 invalid id, 404 not found.

---

## `DELETE /api/games/[id]`

Hard delete.

### Auth: public.
### Responses: 200 `{ ok: true }`, 400 invalid id.

Does NOT cascade — `GameResult` rows referencing this game are orphaned. Today the leaderboard `getTeamBreakdown` filters out missing games via `gameMap.get`, so orphan rows just disappear from the UI but remain in the DB. See [scoring/gotchas.md](../scoring/gotchas.md).

---

## `GET /api/games/by-slug/[slug]`

[Source](../../app/api/games/by-slug/[slug]/route.ts)

Lookup by slug.

### Auth: public.
### Responses: 200 doc / 404 not found.

---

## `GET /api/game-results`

[Source](../../app/api/game-results/route.ts)

List results for a `(sessionId, gameId)` pair.

### Auth: public.
### Query: `sessionId`, `gameId` (both required).
### Response 200: `IGameResult[]`.
### Errors: 400 missing params.

---

## `POST /api/game-results`

Upsert placements / manual scores for one game.

### Auth: public.
### Body for placement modes
```json
{
  "sessionId": "<id>",
  "gameId": "<id>",
  "results": [
    { "teamId": "<id>", "placement": 1, "completedAt": "2026-04-29T...", "notes": "...", "updateReason": "..." },
    /* exactly maxPlacements (6) rows, placements 1..6 unique, no gaps */
  ]
}
```

### Body for `manual_points` mode
```json
{
  "sessionId": "<id>",
  "gameId": "<id>",
  "results": [
    { "teamId": "<id>", "points": 8.5, "notes": "...", "updateReason": "..." },
    /* exactly one row per team, points in [0, manualPointsMax] */
  ]
}
```

### Responses

| Status | Body |
|---|---|
| 200 | `IGameResult[]` (the saved rows) |
| 400 | `{ error: "Invalid ids" }` |
| 400 | `{ error: "Expected exactly 6 team results, got N" }` |
| 400 | `{ error: "Placements must be exactly 1 through N with no gaps" }` |
| 400 | `{ error: "Each score must be between 0 and N" }` |
| 404 | `{ error: "Game not found" }` |
| 500 | `{ error }` |

### Side effects
`GameResult.bulkWrite` upserts one row per team; the unique compound index on `(sessionId, gameId, teamId)` prevents duplicates and lets a single bulkWrite both insert new rows and update existing ones.

For `manual_points` writes, `placement` is computed by ranking points desc with `sortOrder` tiebreak — the leaderboard breakdown UI uses this for ordering only, not for points math.
