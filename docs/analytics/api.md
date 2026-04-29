# analytics — api

## `GET /api/camp/analytics`

[Source](../../app/api/camp/analytics/route.ts)

Comeback analytics for one team in one session. Wraps [`getComebackAnalytics`](../../lib/scoring/comeback.ts).

### Auth: public (no admin or camp gate check today).
### Query
- `sessionId` (ObjectId, required)
- `teamId` (ObjectId, required)

### Responses

| Status | Body |
|---|---|
| 200 | `ComebackAnalytics` (see [comeback.types.ts](../../lib/scoring/comeback.types.ts)) |
| 400 | `{ error: "sessionId and teamId required" }` (missing) |
| 400 | `{ error: "Invalid ids" }` (not valid ObjectIds) |
| 404 | `{ error: "No data" }` (no teams in the session) |
| 500 | `{ error }` |

### `ComebackAnalytics` shape

```ts
{
  teamId, teamName, rank, totalTeams,
  currentPoints, leaderPoints, gapToLeader,
  teamAbove: { name, points, gapPoints } | null,
  teamBelow: { name, points, gapPoints } | null,
  sumMaxRemaining, sumMinRemaining,
  yourBestPossibleTotal, leaderPessimisticTotal,
  comebackStillPossible: string,
  pointsToPassNext: number | null,
  pointsToEscapeLast: number | null,
  games: GameScoringRow[]
}
```

See [scoring/architecture.md](../scoring/architecture.md#comeback-analytics) for math.

---

## `GET /api/public/session`

[Source](../../app/api/public/session/route.ts)

Latest active session + its teams. No secrets.

### Auth: public.
### Query: none.

### Response 200

```json
{
  "session": { "id": "...", "label": "Youth Camp 2026" },
  "teams": [
    { "id": "...", "name": "Team 1", "color": "#ef4444", "loginUsername": "team1" },
    /* ... */
  ]
}
```

If there's no session at all:
```json
{ "session": null, "teams": [] }
```

### Errors
| Status | Body |
|---|---|
| 500 | `{ error }` |

### What's NOT in the response

- `passwordHash` — `select: false` ensures it's never returned.
- `sortOrder` — not exposed (internal sort field).
- `sessionId` on each team — implied by the wrapping `session.id`.
- `Session.active` flag — assumed since this route returns the latest.
- Game definitions — not part of this surface.

The route is intentionally lean: just enough for a login picker.
