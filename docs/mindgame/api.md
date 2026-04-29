# mindgame — api

## `GET /api/mindgame/state`

[Source](../../app/api/mindgame/state/route.ts)

Load the latest saved state for a `(clientKey, sessionId, teamId)` triple.

### Auth: `requireCampAuthIfEnabled()` — passes when gate is off; otherwise requires `youthcamp_camp_auth=1`.

### Query
- `clientKey` — string (default `"default"`)
- `sessionId` — ObjectId or omitted (becomes null)
- `teamId` — ObjectId or omitted (becomes null)

### Responses

| Status | Body |
|---|---|
| 200 | `IMindgameState` or `null` if no save |
| 401 | `{ error: "Login required" }` (gate on, no cookie) |
| 500 | `{ error }` |

The compound unique index has at most one row per tuple, but the route still uses `.findOne(...).sort({ updatedAt: -1 })` defensively in case duplicates ever exist.

---

## `POST /api/mindgame/state`

Upsert the state for a tuple.

### Auth: same as GET.

### Body
```json
{
  "clientKey": "group:<sessionId>:<teamId>:10",
  "sessionId": "<id-or-omit>",
  "teamId": "<id-or-omit>",
  "gridRows": 10, "gridCols": 3, "playerCount": 10,
  "positions": [{"pinIndex": 0, "r": 5, "c": 1}, ...],
  "blocked": [{"r": 0, "c": 0}, ...],
  "diagonalNodes": [{"r": 3, "c": 0}, ...],
  "goal": "sort_desc",
  "moves": 17
}
```

### Responses

| Status | Body |
|---|---|
| 200 | The upserted `IMindgameState` document (with `_id`, timestamps) |
| 401 | `{ error: "Login required" }` |
| 500 | `{ error }` |

### Side effects

`MindgameState.findOneAndUpdate({clientKey, sessionId, teamId}, $set, { upsert: true, new: true })`. Compound unique index ensures at most one row per tuple.

The route writes whatever the client sends — there is no engine-side validation. The client is the source of truth.

## What's NOT here

- No DELETE endpoint. To clear a save, post a fresh state or run `/api/admin/reset-camp` (which deletes by sessionId).
- No batch / list endpoint. You can't enumerate every team's mindgame state from a single API call.
- No action endpoint. Moves are computed client-side; only checkpoints are persisted.
