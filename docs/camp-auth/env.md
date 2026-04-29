# camp-auth — env

| Variable | Required | Effect | Default |
|---|---|---|---|
| `CAMP_REQUIRE_LOGIN` | no | Enables the gate when set to a non-disabled value | unset (gate off) |
| `CAMP_LOGIN_PASSWORD` | no | **Legacy** — any non-empty value enables the gate | unset |
| `TEAM_SEED_PASSWORD` | no | Password assigned to all teams by the seed | `"youthcamp"` |

## `CAMP_REQUIRE_LOGIN` — the canonical gate switch

Set to any non-disabled value to require login on `/camp/**` and `/play/**`:

| Value | Gate state |
|---|---|
| unset / empty / `"0"` / `"false"` / `"no"` / `"off"` | **off** |
| `"1"` / `"true"` / `"yes"` / `"on"` / any other non-empty string | **on** |

Disabled values are case-insensitive (handled by `.toLowerCase()` in [auth.ts:18](../../lib/camp/auth.ts#L18)).

## `CAMP_LOGIN_PASSWORD` — legacy

Earlier versions of the app used a single shared password across all camp users. That code path is gone, but the env var is still checked by `isCampGateEnabled()` for back-compat:

> If `CAMP_LOGIN_PASSWORD?.trim().length > 0`, the gate is on.

Don't rely on it for new deployments. Use `CAMP_REQUIRE_LOGIN=1` and let the per-team `team1`…`team6` accounts handle login. If you set both, the gate is on (legacy short-circuits).

## `TEAM_SEED_PASSWORD`

Read by [`getTeamSeedPassword()`](../../lib/seed/sync-team-logins.ts) inside `syncTeamLoginsForSession`. Defaults to the literal string `"youthcamp"`.

Used:
- During seed (Admin → Seed) — bcrypt-hashes this and writes to every team's `passwordHash`.
- During team bulk update via `PATCH /api/teams` — that route takes a body `{password}` instead and ignores the env var.

Changing `TEAM_SEED_PASSWORD` only takes effect after re-seeding.

## What does **not** belong in camp-auth env

- `MONGODB_URI` — see [db/env.md](../db/env.md)
- `ADMIN_SECRET` — see [admin/env.md](../admin/env.md)
- `CLOUDINARY_*` — see [media-uploads/env.md](../media-uploads/env.md)

## Putting it together (production checklist)

```dotenv
# .env (production)
MONGODB_URI=mongodb+srv://...
ADMIN_SECRET=<long random string>
CAMP_REQUIRE_LOGIN=1
TEAM_SEED_PASSWORD=<your camp password>
```

Then **Admin → Seed** to ensure team accounts are created with the new password.
