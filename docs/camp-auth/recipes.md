# camp-auth — recipes

## Recipe: add a new team-bound API route

Use this when the route reads/writes data that belongs to a specific team.

```ts
// app/api/<feature>/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { CAMP_AUTH_COOKIE, CAMP_TEAM_COOKIE, isCampGateEnabled } from "@/lib/camp/auth";
import { dbConnect } from "@/lib/db/connect";
import mongoose from "mongoose";

async function requireAuth(): Promise<boolean> {
  if (!isCampGateEnabled()) return true;
  const jar = await cookies();
  return jar.get(CAMP_AUTH_COOKIE)?.value === "1";
}

export async function GET(req: Request) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "Login required" }, { status: 401 });
  }
  const jar = await cookies();
  const teamId = jar.get(CAMP_TEAM_COOKIE)?.value;
  if (!teamId || !mongoose.isValidObjectId(teamId)) {
    return NextResponse.json({ error: "No team" }, { status: 401 });
  }
  await dbConnect();
  // …
}
```

**Why not `requireCampTeamForGameRoute`?** That helper redirects (page-style), not 401-returns (API-style). Use it only inside server pages.

## Recipe: add a new SSR page that needs a team

```ts
// app/<feature>/page.tsx
import { requireCampTeamForGameRoute } from "@/lib/camp/team-game-access";

export const dynamic = "force-dynamic";

export default async function MyPage() {
  const { sessionId, teamId } = await requireCampTeamForGameRoute("/<feature>");
  // …
}
```

`requireCampTeamForGameRoute` redirects to `/login?next=...` on miss; you don't need to handle that case.

## Recipe: enable / disable the gate

**Enable** (production, demos that need access control):
```dotenv
CAMP_REQUIRE_LOGIN=1
```

**Disable** (local dev, anonymous access):
```dotenv
# either omit, or:
CAMP_REQUIRE_LOGIN=0
```

The legacy `CAMP_LOGIN_PASSWORD` variable also enables the gate when set — but use `CAMP_REQUIRE_LOGIN` for new deployments. See [env.md](./env.md).

After changing, **restart the dev server** — env vars are read on first call but Next.js caches.

## Recipe: change the seeded team password

```dotenv
TEAM_SEED_PASSWORD=mynewpassword
```

Then run **Admin → Seed**. `syncTeamLoginsForSession` rehashes the password for every team in the session. Existing usernames are preserved; only the hash is updated. Sessions / game definitions / game results are untouched.

Bulk update outside of seed:

```bash
# admin must be authenticated
curl -X PATCH /api/teams \
  -H 'content-type: application/json' \
  -d '{"sessionId":"<id>","password":"newpw"}'
```

## Recipe: rename a team's login username

`PATCH /api/teams/[id]` accepts `{ loginUsername }`. Lowercased + trimmed before save. Uniqueness is enforced by the partial index — a duplicate raises `E11000` and Mongoose surfaces it as a 500. See [teams/api.md](../teams/api.md).

## Recipe: add a new cookie to the camp auth surface

Don't add a third cookie unless you genuinely need a third axis (today: "did you authenticate" + "what team"). If you must:

1. Add a `CAMP_<NAME>_COOKIE` constant to [lib/camp/auth.ts](../../lib/camp/auth.ts).
2. Update middleware to read/clear if needed.
3. Update `/api/camp/login` and `/api/camp/logout` to set/delete it.
4. Document the cookie in [architecture.md](./architecture.md) and [api.md](./api.md).

## Recipe: invalidate all camp logins (force re-login)

Delete the cookie name reservation by changing `CAMP_AUTH_COOKIE` (e.g. append `_v2`). Existing browsers will fail the gate and be redirected to login. Coordinate with the seed (they'll have the same `team1`…`team6` accounts).

For a softer reset, rotate `TEAM_SEED_PASSWORD` and re-seed — old passwords stop working but cookies that haven't expired still pass the gate. To force-clear cookies you have to rotate the cookie name.

## Recipe: lock down a team's access

There is **no per-team disable flag** today. To suspend a team:
- Bulk-rotate `TEAM_SEED_PASSWORD` and re-seed → all teams locked out until they get the new password.
- Or `DELETE /api/teams/<id>` to remove the team entirely (also deletes their `GameResult` rows transitively only if you cascade — currently it does not, see [teams/gotchas.md](../teams/gotchas.md)).

If you find yourself needing finer-grained access control, that's a sign the casual-trust model has outgrown the use case. Consider adding a `disabled: Boolean` field to `Team` and check it in `/api/camp/login`.
