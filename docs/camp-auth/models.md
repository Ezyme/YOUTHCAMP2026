# camp-auth — models

The `Team` model owns the credential fields. Full schema reference is in [db/models.md](../db/models.md#team) — this file calls out only the bits that matter for auth.

## `Team.loginUsername`

- Type: `String`, lowercase, trimmed.
- Optional.
- Combined with `sessionId` in a **partial** unique index — uniqueness is only enforced when `loginUsername` is non-empty.

The partial filter is `{ loginUsername: { $gt: "" } }` ([models.ts:274-280](../../lib/db/models.ts#L274-L280)). Without it, sparse-unique would treat multiple teams with no username as duplicate `(sessionId, null)` and block the seed. See [db/gotchas.md](../db/gotchas.md).

`syncTeamLoginsForSession` ([lib/seed/sync-team-logins.ts](../../lib/seed/sync-team-logins.ts)) assigns `team1`…`teamN` to teams that don't already have one. Admin can override per-team via `/api/teams/[id]` PATCH ([app/api/teams/[id]/route.ts:20-22](../../app/api/teams/[id]/route.ts#L20-L22)).

## `Team.passwordHash`

- Type: `String`, **`select: false`**.
- bcrypt hash, 10 salt rounds (see [lib/camp/password.ts](../../lib/camp/password.ts)).
- Never returned by `.find()` unless the caller opts in with `.select("+passwordHash")`.

The login route is the only place that opts in:

```ts
const team = await Team.findOne({ sessionId, loginUsername }).select("+passwordHash");
```

[app/api/camp/login/route.ts:51-54](../../app/api/camp/login/route.ts#L51-L54)

The password is set/refreshed from `TEAM_SEED_PASSWORD` (default `"youthcamp"`) by `syncTeamLoginsForSession` on every seed run, and bulk-updateable via `PATCH /api/teams` ([app/api/teams/route.ts:95-123](../../app/api/teams/route.ts#L95-L123)).

## What is **not** in the model

- The cookie value (`"1"`) is a literal — not stored in the DB.
- There is no session table for camp auth. The cookie is a **bearer token that just says "yes"** — its presence is sufficient. Validity expires when the cookie does (14 days).
- There is no rate limit, no failed-login counter, no lockout. Three-character minimum on bulk password update is the only floor (see [app/api/teams/route.ts:104](../../app/api/teams/route.ts#L104)).

## Security posture

This is a casual-trust system designed for a youth camp where six teams share a friendly password. Treat it accordingly:

- Don't expose camp endpoints to the public internet without rate-limiting.
- Don't reuse `TEAM_SEED_PASSWORD` for anything that needs real security.
- Don't store sensitive PII on `Team` — there is no per-user account, just per-team.
