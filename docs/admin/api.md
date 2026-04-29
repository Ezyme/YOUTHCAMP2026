# admin — api

Routes under `app/api/admin/**`. Every handler **must** call `verifyAdminRequest()` from [`@/lib/admin-auth`](../../lib/admin-auth.ts) (returns 403 on failure).

> Admin panel mutations that are **NOT** admin-namespaced (e.g. `/api/games`, `/api/teams`, `/api/game-results`, `/api/unmasked/codes`) are documented under their owning domains. They're effectively open.

## `POST /api/admin/login`

[Source](../../app/api/admin/login/route.ts)

Set the `youthcamp_admin` cookie if the body secret matches `ADMIN_SECRET`.

### Auth: public.

### Request body
```json
{ "secret": "<the configured ADMIN_SECRET>" }
```

### Responses

| Status | Body | When |
|---|---|---|
| 200 | `{ ok: true, message: "No ADMIN_SECRET set" }` | env var unset |
| 200 | `{ ok: true }` | match → cookie set |
| 401 | `{ error: "Unauthorized" }` | mismatch |

### Side effects (success with secret set)
`Set-Cookie: youthcamp_admin=<secret>; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800` (7 days)

---

## `POST /api/admin/reset-camp`

[Source](../../app/api/admin/reset-camp/route.ts)

Wipe per-session play state for the active session. Preserves game definitions and team rosters/credentials.

### Auth: `verifyAdminRequest()`.

### Request body: empty.

### Responses

| Status | Body | When |
|---|---|---|
| 200 | `{ ok, sessionId, deletedGameResults, deletedMindgameStates, deletedUnmaskedStates, powerUpCodesRedemptionsCleared }` | success |
| 400 | `{ error: "No active session — run seed first" }` | no `Session({active:true})` |
| 403 | `{ error: "Unauthorized" }` | bad secret |
| 500 | `{ error }` | DB failure |

### Side effects
- `GameResult.deleteMany({sessionId})`
- `MindgameState.deleteMany({sessionId})`
- `UnmaskedState.deleteMany({sessionId})`
- `PowerUpCode.updateMany({sessionId}, {$set: {redeemedBy: []}})`

---

## `GET /api/admin/unmasked/state`

[Source](../../app/api/admin/unmasked/state/route.ts)

Read-only spectator state for one team. Migrates legacy fields on read.

### Auth: `verifyAdminRequest()`.

### Query
- `sessionId` (ObjectId, required)
- `teamId` (ObjectId, required)

### Responses

| Status | Body | When |
|---|---|---|
| 200 | `IUnmaskedState` | ok |
| 400 | `{ error: "sessionId and teamId required" }` | missing/invalid params |
| 403 | `{ error: "Unauthorized" }` | bad secret |
| 404 | `{ error: "No saved game for this team yet" }` | no `UnmaskedState` row |

Does **not** bump `lastPlayActivityAt`.

---

## `POST /api/admin/unmasked/reset`

[Source](../../app/api/admin/unmasked/reset/route.ts)

Reset Unmasked state for one team. Two actions.

### Auth: `verifyAdminRequest()`.

### Request body
```json
{ "sessionId": "<id>", "teamId": "<id>", "action": "timer" | "board", "slug": "unmasked" }
```

`slug` defaults to `"unmasked"` and is only used by `action: "board"` to look up the live `GameDefinition.settings`.

### Action: `timer`
Sets `startedAt: new Date()`, `checkPassagePenaltySeconds: 0`, `lastPlayActivityAt: null`. Board, hearts, redeemed codes, power-ups preserved.

### Action: `board`
Calls `resetUnmaskedBoardKeepTimer`. Reshuffles minefield + verses. Preserves run timer (`startedAt`). Re-applies redeemed codes to power-up inventory and bonus hearts/shield.

### Responses

| Status | Body |
|---|---|
| 200 | The updated `UnmaskedState` |
| 400 | `{ error: "sessionId and teamId required" }` or `'action must be "timer" or "board"'` |
| 403 | `{ error: "Unauthorized" }` |
| 404 | `{ error: "No game state for this team" }` |
| 500 | `{ error }` |

---

## `GET /api/admin/unmasked/teams`

[Source](../../app/api/admin/unmasked/teams/route.ts)

List Unmasked status for every team in a session.

### Auth: `verifyAdminRequest()`.

### Query
- `sessionId` (ObjectId, required)

### Response 200
```json
{
  "teams": [
    {
      "teamId": "...", "teamName": "Team 1", "color": "#ef4444",
      "hasState": false                    // when no UnmaskedState row
    },
    {
      "teamId": "...", "teamName": "Team 2", "color": "#f97316",
      "hasState": true,
      "status": "playing",
      "passagesComplete": false,
      "hearts": 3, "maxHearts": 3, "liesHit": 0, "shielded": false,
      "gridSize": 20, "totalLies": 112, "totalCells": 400, "revealedCount": 17,
      "redeemedCodes": ["ABC123"],
      "powerUps": [...],
      "startedAt": "2026-04-29T...", "finishedAt": null,
      "checkPassagePenaltySeconds": 0,
      "verseKeys": ["psalm139_14", ...], "versesRestored": []
    }
  ]
}
```

---

## `POST /api/admin/unmasked/power-up-grant-all`

[Source](../../app/api/admin/unmasked/power-up-grant-all/route.ts)

Grant a code to every eligible team. Universal codes → all teams; per-team codes → just the assigned team.

### Auth: `verifyAdminRequest()`.

### Request body
```json
{ "sessionId": "<id>", "codeId": "<PowerUpCode _id>" }
```

### Responses

| Status | Body |
|---|---|
| 200 | `{ ok, targetTeamCount, grantedUnmaskedStates, skippedAlreadyHadCode, teamsWithoutUnmaskedState }` |
| 400 | various — invalid IDs, per-team without `teamId`, no teams in session |
| 403 | `{ error: "Unauthorized" }` |
| 404 | `{ error: "Code not found for this session" }` |
| 500 | `{ error }` |

### Side effects
- `PowerUpCode.redeemedBy` includes every target team (`$addToSet`).
- For target teams **with** an `UnmaskedState`: applies the grant via `buildUnmaskedGrantUpdateForPowerUp` (immediate hearts/shield/inventory update).
- For target teams **without** an `UnmaskedState`: only updates `redeemedBy`. They get the grant on first state load via the redeem repair path.
