# teams — architecture

## Public-namespaced

Routes live under `/api/teams/**`, NOT under `/api/admin/teams/**`. They have **no auth check** today. The admin panel calls them; nothing prevents an external caller from doing the same.

This is consistent with the rest of the panel-driven mutation surfaces (`/api/games`, `/api/game-results`, `/api/unmasked/codes`). See [admin/architecture.md](../admin/architecture.md).

## Routes

| Route | Methods |
|---|---|
| `/api/teams` | `GET ?sessionId`, `POST`, `PATCH` |
| `/api/teams/[id]` | `PATCH`, `DELETE` |

### `GET /api/teams?sessionId=<id>`
List teams in a session, sorted `sortOrder, name`. Excludes `passwordHash` (`select: "-passwordHash"`).

### `POST /api/teams`
Two body shapes:

1. **Bootstrap** (`{ sessionId, bootstrap: true }`) — inserts 6 default teams (Team 1 … Team 6) with paint colors. Refuses if any team already exists in the session. Then calls `syncTeamLoginsForSession` to assign `team1`…`team6` usernames.
2. **Single team** (`{ sessionId, name, color, sortOrder, loginUsername? }`) — creates one team. Lowercases `loginUsername`.

### `PATCH /api/teams`
Bulk-update password. Body `{ sessionId, password }`. bcrypt-hashes the plaintext, writes to every team in the session via `Team.updateMany`. Minimum 3 chars (otherwise 400).

### `PATCH /api/teams/[id]`
Update one team's `name`, `color`, or `loginUsername`. Lowercases username. Excludes `passwordHash` from response.

### `DELETE /api/teams/[id]`
Hard delete. Does NOT cascade to `GameResult`, `UnmaskedState`, `MindgameState`, `PowerUpCode.redeemedBy`. See [gotchas.md](./gotchas.md).

## Who calls these routes

- **Admin panel** — `<TeamsClient>` ([components/admin/teams-client.tsx](../../components/admin/teams-client.tsx)) for CRUD; `<ScoringPanel>` indirectly via the public route.
- **Public session API** — `/api/public/session` returns a similar list shape (no passwordHash, only id/name/color/loginUsername). See [analytics/api.md](../analytics/api.md).
- **Camp dashboard** — `<CampDashboard>` reads team list from server-side props (not the API).

## Layer position

```
[Browser] → /api/teams[/...]
                │
                ▼
       Mongoose Team model
                │
                ▼
       lib/db/models.ts (schema + partial-unique index)
                │
                ▼
       lib/camp/password.ts hashPassword (PATCH /api/teams)
       lib/seed/sync-team-logins.ts (POST /api/teams { bootstrap: true })
```

The handlers are thin — most logic is delegated to camp-auth (password) or seed (bootstrap username sync).
