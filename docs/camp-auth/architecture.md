# camp-auth — architecture

## Two cookies, one auth

Camp auth uses **two** httpOnly cookies, both set by `/api/camp/login` and read everywhere else:

| Cookie | Value | Set by | Read by |
|---|---|---|---|
| `youthcamp_camp_auth` | literal `"1"` | login route | middleware, every camp/team-bound API, all SSR pages that show camp UI |
| `youthcamp_team_id` | the team's `_id` (string) | login route, `/api/camp/select-team` | game routes, dashboard analytics |

Names live in [lib/camp/auth.ts](../../lib/camp/auth.ts) as `CAMP_AUTH_COOKIE` and `CAMP_TEAM_COOKIE`. Don't hand-write the strings — always import the constant.

## The gate

`isCampGateEnabled()` ([auth.ts:14](../../lib/camp/auth.ts#L14)) returns true when **either**:

1. `CAMP_LOGIN_PASSWORD` is set and non-empty (legacy variable), **or**
2. `CAMP_REQUIRE_LOGIN` is set and is **not** one of `"0" | "false" | "no" | "off" | ""`.

When the gate is **off**, [middleware.ts](../../middleware.ts) skips the cookie check on `/camp/**` and `/play/**`, and `/api/camp/login` sets the auth cookie unconditionally for any caller. This is **intentional** — local dev and demo deployments run without the gate so anyone can poke around the games. Never assume the gate is on in production code.

## Where the gate is enforced

| Location | Behavior when gate ON |
|---|---|
| [middleware.ts](../../middleware.ts) | Redirects `/camp/**` and `/play/**` to `/login?next=…` if cookie missing |
| `/api/camp/login` | Validates username + password against `Team` |
| `/api/unmasked/state`, `/api/unmasked/action`, `/api/unmasked/redeem` | `requireAuth()` returns 401 if cookie missing |
| `/api/mindgame/state` | `requireCampAuthIfEnabled()` returns 401 if cookie missing |
| `/games/**` SSR | `loadCampTeamScoredGames()` redirects to `/login` if no team cookie |

API routes outside that list (e.g. `/api/teams`, `/api/games`, `/api/leaderboard`) are **public** — no gate. They only return non-secret data.

## Team identity vs gate auth

The two cookies serve different purposes:

- `youthcamp_camp_auth=1` proves the user passed the gate.
- `youthcamp_team_id=<id>` answers *which* team this browser is acting as.

Most game routes need both: gate (to prove access) + team id (to know whose state to load). The `select-team` API only flips `youthcamp_team_id` — it does **not** re-validate credentials, since the gate cookie is enough to prove the user has authenticated.

## Open-redirect guard

`safeCampLoginNext(raw)` ([auth.ts:33](../../lib/camp/auth.ts#L33)) sanitizes the `next` query param on `/login`. It rejects:
- `null` / non-string
- Anything that doesn't start with `/`
- `//` (protocol-relative)
- Anything containing `://`

Returns `/camp` as the safe default. Used in [app/login/page.tsx](../../app/login/page.tsx) and [app/login/camp-login-form.tsx](../../app/login/camp-login-form.tsx).

## Independence from admin auth

Admin auth uses a different cookie (`youthcamp_admin`) and a different secret (`ADMIN_SECRET`). The two systems do not share any code — see [admin/architecture.md](../admin/architecture.md). A user who is logged in as a team is **not** an admin (unless they also have the admin cookie).

## Layer position

```
[Browser]
  → POST /api/camp/login (username, password)
  → reads cookies on every subsequent request
[middleware.ts]
  → checks cookie value === "1" for /camp/* and /play/*
  → redirects to /login on miss
[app/api/camp/...]
  → reads cookies via next/headers
[lib/camp/auth.ts]            ← cookie name constants + gate check
[lib/camp/password.ts]        ← bcrypt
[lib/camp/team-game-access.ts] ← team-bound page helpers
        ↓
[lib/db/models.ts → Team]     ← passwordHash (select: false), loginUsername
```
