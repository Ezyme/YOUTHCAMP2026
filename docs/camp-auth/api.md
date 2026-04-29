# camp-auth — api

All routes live under `app/api/camp/**`. None require admin privileges.

## `POST /api/camp/login`

[Source](../../app/api/camp/login/route.ts)

Authenticate a team and set the camp cookies.

### Auth
- Public.
- If the gate is **off**, succeeds without checking credentials (sets only `youthcamp_camp_auth`).

### Request body
```json
{ "username": "team1", "password": "youthcamp" }
```

### Responses

| Status | Body | When |
|---|---|---|
| 200 | `{ ok: true, alreadyAuthenticated: true }` | Caller already has the auth cookie |
| 200 | `{ ok: true, message: "Camp gate off — …" }` | Gate disabled (no cred check, no team cookie) |
| 200 | `{ ok: true, teamId: string, teamName: string }` | Successful login |
| 400 | `{ error: "Username and password required" }` | Missing fields (gate on) |
| 401 | `{ error: "Unknown user — run seed to create team1…team6 accounts" }` | Username not found in current session |
| 401 | `{ error: "Invalid credentials" }` | Password mismatch |
| 404 | `{ error: "No camp session" }` | No `Session` rows yet |
| 500 | `{ error: <message> }` | DB / unexpected error |

### Side effects (success)
Sets two `Set-Cookie` headers:
- `youthcamp_camp_auth=1; HttpOnly; SameSite=Lax; Path=/; Max-Age=1209600`
- `youthcamp_team_id=<teamId>; HttpOnly; SameSite=Lax; Path=/; Max-Age=1209600`

(14-day max age.)

---

## `POST /api/camp/logout`

[Source](../../app/api/camp/logout/route.ts)

Clear the camp cookies. Always succeeds.

### Auth
- Public.

### Request body
None.

### Response
Always `200 { ok: true }`.

### Side effects
Deletes both cookies.

---

## `POST /api/camp/select-team`

[Source](../../app/api/camp/select-team/route.ts)

Switch which team this browser is acting as. Only updates the `youthcamp_team_id` cookie — does **not** re-authenticate.

### Auth
- Implicit: requires the caller to already have `youthcamp_camp_auth=1` (the route doesn't check, but every caller is the dashboard and middleware has already let them past the gate).

### Request body
```json
{ "teamId": "<24-char ObjectId>" }
```

### Responses

| Status | Body | When |
|---|---|---|
| 200 | `{ ok: true }` | Cookie updated |
| 400 | `{ error: "Invalid team" }` | `teamId` not a valid ObjectId |

The route doesn't verify the team exists in the current session — the dashboard's analytics call will filter by session, so a stale id just returns no data.

### Side effects
Sets `youthcamp_team_id=<teamId>` cookie. Same attributes as login (httpOnly, lax, /, 14d).
