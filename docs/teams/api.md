# teams — api

All routes are public-namespaced and **don't auth-check** today.

## `GET /api/teams?sessionId=<id>`

[Source](../../app/api/teams/route.ts)

List teams in a session.

### Query
- `sessionId` (required)

### Response 200
`Array<Omit<ITeam, "passwordHash">>` — sorted by `sortOrder, name`.

### Errors
| Status | Body |
|---|---|
| 400 | `{ error: "sessionId query required" }` |
| 500 | `{ error }` |

---

## `POST /api/teams`

Create a team or bootstrap 6 default teams.

### Body — bootstrap mode
```json
{ "sessionId": "<id>", "bootstrap": true }
```

Refuses with 400 if any team already exists in the session. On success, inserts 6 default teams (`Team 1`…`Team 6`, paint colors, sortOrder 0–5) and calls `syncTeamLoginsForSession` to assign `team1`…`team6` usernames + bcrypt the seed password.

#### Response 200
`Array<Omit<ITeam, "passwordHash">>` — the 6 inserted teams with their assigned `loginUsername`.

### Body — single-team mode
```json
{
  "sessionId": "<id>",
  "name": "Red Phoenix",
  "color": "#ef4444",
  "sortOrder": 0,
  "loginUsername": "red"
}
```

`name` defaults to `"Team"`, `color` to `"#6366f1"`, `sortOrder` to `0`. `loginUsername` is lowercased + trimmed.

#### Response 200
The created `Team` doc (with `passwordHash` since it isn't filtered on insert response).

### Errors
| Status | Body |
|---|---|
| 400 | `{ error: "sessionId required" }` or `"Teams already exist for this session"` |
| 500 | `{ error }` |

---

## `PATCH /api/teams`

Bulk-update password for every team in a session.

### Body
```json
{ "sessionId": "<id>", "password": "newpassword" }
```

bcrypt-hashes the plaintext (10 rounds via [`hashPassword`](../../lib/camp/password.ts)) and writes to every team's `passwordHash` via `Team.updateMany`.

### Response 200
```json
{ "ok": true, "updated": 6 }
```

### Errors
| Status | Body |
|---|---|
| 400 | `{ error: "sessionId required" }` (invalid ObjectId or missing) |
| 400 | `{ error: "Password must be at least 3 characters" }` |
| 500 | `{ error }` |

---

## `PATCH /api/teams/[id]`

[Source](../../app/api/teams/[id]/route.ts)

Update one team's `name`, `color`, or `loginUsername`.

### Path
- `id` — ObjectId

### Body
Any subset of:
```json
{ "name": "...", "color": "#hex", "loginUsername": "lowercased" }
```

`loginUsername` is lowercased + trimmed before save.

### Response 200
The updated `Team` doc (without `passwordHash`).

### Errors
| Status | Body |
|---|---|
| 400 | `{ error: "Invalid id" }` or `"Nothing to update"` |
| 404 | `{ error: "Team not found" }` |
| 500 | `{ error }` |

`PATCH` does **not** support changing `passwordHash` per-team. Use `/api/teams PATCH` for bulk password update, or write directly via Mongo for one-off cases.

---

## `DELETE /api/teams/[id]`

Hard delete a team. **Does not cascade.**

### Response 200
```json
{ "ok": true }
```

### Errors
| Status | Body |
|---|---|
| 400 | `{ error: "Invalid id" }` |
| 500 | `{ error }` |

### Side effects
The team row is removed. Existing `GameResult`, `UnmaskedState`, `MindgameState` rows for this team **are not deleted**. The leaderboard's per-team breakdown will skip rows whose team no longer exists, but `getLeaderboard` builds rows from current `Team` docs only — orphan results don't show. They do, however, accumulate in the DB. See [gotchas.md](./gotchas.md).

`PowerUpCode.redeemedBy` may still contain the deleted team id. The codes route opportunistically prunes orphans on read.
