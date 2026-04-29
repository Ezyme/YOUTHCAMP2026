# seed — api

## `POST /api/seed`

[Source](../../app/api/seed/route.ts)

Bootstrap or refresh games + session + teams + login credentials.

### Auth

If `ADMIN_SECRET` is set in env: requires either:
- HTTP header `x-admin-secret: <secret>`, OR
- POST body `{ secret: "<secret>" }`

If `ADMIN_SECRET` is unset: no auth.

The admin dashboard's `<SeedButton>` POSTs an empty body. With `ADMIN_SECRET` set, this would 401 — **unless** the cookie is set (it isn't checked by this route). The current admin dashboard relies on `ADMIN_SECRET` being **unset** to call seed. See [gotchas.md](./gotchas.md).

### Request body
Optional `{ secret: "..." }`. Other fields ignored.

### Response 200
```json
{
  "ok": true,
  "gamesUpserted": 13,
  "sessionId": "<id>",
  "teamLoginUsernames": ["team1", "team2", "team3", "team4", "team5", "team6"],
  "teamPasswordNote": "All teams share the password from TEAM_SEED_PASSWORD (default: youthcamp). Usernames: team1 … team6."
}
```

### Errors

| Status | Body |
|---|---|
| 401 | `{ error: "Unauthorized" }` (when `ADMIN_SECRET` set and neither header nor body matches) |
| 500 | `{ error: <message> }` |

### Side effects

- For each `CAMP_GAMES` entry: `GameDefinition.findOneAndUpdate({slug}, $set, {upsert: true, new: true, setDefaultsOnInsert: true})`.
  - `$set` always includes name, slug, day, category, engineKey, isPlayable, order, scoring, rulesMarkdown.
  - `$set.settings` is included **only when** `g.settings !== undefined` in `CAMP_GAMES`. Currently only `unmasked` has settings in the seed.
- If no `Session({active: true})`: creates one with `label: "Youth Camp 2026"`.
- If team count for the session is 0: `Team.insertMany([6 default rows])` with names/colors/sortOrder.
- `syncTeamLoginsForSession(session._id)`:
  - Assigns `team${i+1}` to teams without a `loginUsername`.
  - Refreshes every team's `passwordHash` from `TEAM_SEED_PASSWORD` (default `"youthcamp"`).

### Idempotent

Running multiple times is safe. New games are inserted; existing games' fields are refreshed (except `settings` for games with no seed-defined settings). Teams aren't duplicated. Passwords are re-hashed each run, so changing `TEAM_SEED_PASSWORD` and re-seeding rotates credentials.

## What this domain is NOT

- `/api/admin/reset-camp` is a separate route ([admin/api.md](../admin/api.md)). Wipes play state. The `<ResetCampButton>` lives in `components/admin/` because it's an admin action — but is documented here under seed since it's the inverse-flow.
