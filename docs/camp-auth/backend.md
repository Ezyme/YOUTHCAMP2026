# camp-auth — backend

## `lib/camp/auth.ts`

[Source](../../lib/camp/auth.ts).

### Constants

```ts
export const CAMP_AUTH_COOKIE = "youthcamp_camp_auth";
export const CAMP_TEAM_COOKIE = "youthcamp_team_id";
```

Always import these — never hardcode the names.

### `isCampGateEnabled(): boolean`

Returns `true` when the gate should require login. Logic:

1. If `process.env.CAMP_LOGIN_PASSWORD` is set & non-empty → **true** (legacy variable).
2. Otherwise, read `CAMP_REQUIRE_LOGIN`, trim, lowercase. If it's empty / `"0"` / `"false"` / `"no"` / `"off"` → **false**. Otherwise → **true**.

This means `CAMP_REQUIRE_LOGIN=1`, `CAMP_REQUIRE_LOGIN=true`, `CAMP_REQUIRE_LOGIN=yes`, even `CAMP_REQUIRE_LOGIN=foo` all enable the gate. Be deliberate when setting this — empty / off-values are special.

`isCampLoginEnforced()` is a deprecated alias kept for backward compat.

### `safeCampLoginNext(raw: string | null | undefined): string`

Open-redirect guard. Default return is `/camp`. Returns `raw` only if all of:
- It's a string.
- It decodes successfully (otherwise → default).
- It starts with `/`.
- It does **not** start with `//` (protocol-relative).
- It does **not** contain `://`.

Used in:
- [app/login/page.tsx](../../app/login/page.tsx) (server-side redirect)
- [app/login/camp-login-form.tsx](../../app/login/camp-login-form.tsx) (client-side navigation target)

Never bypass it. Inserting an unsanitized `next` into `window.location.assign` is an open redirect.

## `lib/camp/password.ts`

[Source](../../lib/camp/password.ts). Tiny wrapper around bcrypt.

```ts
hashPassword(plain): Promise<string>          // bcrypt.hash with 10 rounds
verifyPassword(plain, hash): Promise<boolean> // returns false on empty hash
```

The `verifyPassword` early-returns `false` for an empty hash so a missing password doesn't accidentally accept any input.

10 rounds is intentional — stronger than nothing, fast enough that login feels instant on modest hardware. If the threat model ever changes, bump the constant in this file.

## `lib/camp/team-game-access.ts`

[Source](../../lib/camp/team-game-access.ts). Server helpers for SSR pages that need team identity + scored-game data.

### `loadCampTeamScoredGames()`

Returns `{ status: "no_session" } | { status: "ok", data: { sessionId, teamId, scoredGameIds } }`.

Steps:
1. `dbConnect`.
2. Latest session by `createdAt`. If none → `{ status: "no_session" }`.
3. Read `youthcamp_team_id` cookie. If missing or invalid ObjectId → redirect to `/login?next=/games`.
4. Verify the team exists in this session. If not → redirect to `/login?next=/games`.
5. Fetch every `GameResult` for this `(session, team)` and return the set of `gameId`s.

Used by [`/games`](../../app/games/page.tsx) to decide which Day 1–2 cards are visible.

### `requireCampTeamForGameRoute(nextPath)`

Returns `{ sessionId, teamId }` after redirecting to `/login?next=<nextPath>` on miss. Used by `/games/[slug]` and `/play/[gameSlug]` (indirectly).

### `teamHasGameResult(sessionId, teamId, gameId)`

Boolean: does a `GameResult` exist for that triple? Used by `/games/[slug]` to gate non-playable game detail pages until the team has been scored.

## Login route — [`/api/camp/login`](../../app/api/camp/login/route.ts)

POST handler. Behavior depends on gate state:

| Gate state | Body | Action |
|---|---|---|
| Already authed (cookie === "1") | any | 200 `{ ok: true, alreadyAuthenticated: true }` |
| Off | any | Set `youthcamp_camp_auth=1`, no team cookie, 200 `{ ok: true, message }` |
| On, missing creds | empty | 400 `Username and password required` |
| On, no session | valid | 404 `No camp session` |
| On, unknown user | valid | 401 `Unknown user — run seed to create team1…team6 accounts` |
| On, wrong password | valid | 401 `Invalid credentials` |
| On, success | valid | Set both cookies, 200 `{ ok: true, teamId, teamName }` |

Cookie attributes (both):
- `httpOnly: true`
- `sameSite: "lax"`
- `path: "/"`
- `maxAge: 60 * 60 * 24 * 14` (14 days)

## Logout route — [`/api/camp/logout`](../../app/api/camp/logout/route.ts)

POST. Deletes both cookies. Always returns 200. No body required.

## Select-team route — [`/api/camp/select-team`](../../app/api/camp/select-team/route.ts)

POST `{ teamId }`. Validates ObjectId. Sets only `youthcamp_team_id` cookie (does **not** touch `youthcamp_camp_auth`). Does **not** verify the team exists or belongs to the current session — the dashboard's read flow filters by session anyway, and the gate cookie is sufficient proof of authentication.
