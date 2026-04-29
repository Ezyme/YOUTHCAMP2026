# camp-auth — patterns

## 1. Cookie names as exported constants

```ts
// lib/camp/auth.ts
export const CAMP_AUTH_COOKIE = "youthcamp_camp_auth";
export const CAMP_TEAM_COOKIE = "youthcamp_team_id";
```

Every reader / writer imports these. Renaming the literal in one place updates the entire app. Compare with the admin cookie (`"youthcamp_admin"`), which is a hardcoded string — that's an inconsistency that should probably be fixed in admin (see [admin/gotchas.md](../admin/gotchas.md)).

## 2. Two-cookie pattern for "auth + identity"

The auth cookie (`youthcamp_camp_auth=1`) proves you've authenticated. The team cookie (`youthcamp_team_id=<id>`) says which team. The two are independent:

- Logging out clears both.
- Switching teams updates only the team cookie.
- The auth cookie value is a literal `"1"`, not a JWT or session token. Compare for exact equality.

This separates "did the user authenticate" from "what team are they acting as", which the dashboard team-picker exploits.

## 3. Helper-per-purpose for SSR auth checks

The pattern across SSR pages is:

```ts
// in app/.../page.tsx
const ctx = await loadCampTeamScoredGames();         // /games
const team = await requireCampTeamForGameRoute(...); // /games/[slug]
```

These helpers live in [`lib/camp/team-game-access.ts`](../../lib/camp/team-game-access.ts). They:
1. dbConnect.
2. Resolve the latest session.
3. Resolve & validate the team cookie.
4. Redirect to `/login?next=...` on miss.

Don't inline this dance into pages — it's tricky (cookie validation + Mongo isValidObjectId + session match) and easy to get subtly wrong.

## 4. Gate-aware route handlers

API handlers that should only respond to authenticated camp users use:

```ts
async function requireAuth(): Promise<boolean> {
  if (!isCampGateEnabled()) return true;
  const jar = await cookies();
  return jar.get(CAMP_AUTH_COOKIE)?.value === "1";
}
```

That helper appears verbatim in:
- [`/api/unmasked/state`](../../app/api/unmasked/state/route.ts)
- [`/api/unmasked/action`](../../app/api/unmasked/action/route.ts)
- [`/api/unmasked/redeem`](../../app/api/unmasked/redeem/route.ts)
- [`/api/mindgame/state`](../../app/api/mindgame/state/route.ts) (named `requireCampAuthIfEnabled`)

Three duplications and one rename — could be promoted to `lib/camp/auth.ts` if it grows. Today, copy the pattern when adding a new gameplay route.

## 5. `window.location.assign` over `router.push` after login

```ts
// camp-login-form.tsx
window.location.assign(next);
```

Soft-nav (`router.push`) is supposed to send cookies, but in practice the browser's pending-cookie state and React Server Component caching can produce edge cases where the new cookie isn't read on the next request. Full navigation guarantees a clean fetch. See [gotchas.md](./gotchas.md#1-soft-nav-can-lose-the-fresh-cookie).

## 6. Server-only helpers for client-safe types

Comeback analytics has its types extracted into [`lib/scoring/comeback.types.ts`](../../lib/scoring/comeback.types.ts) so client components can import them without pulling in `mongoose`. The dashboard ([components/camp/camp-dashboard.tsx](../../components/camp/camp-dashboard.tsx)) uses this — it imports `ComebackAnalytics` from the types file, never from `comeback.ts`.

Apply the same pattern when extending camp/team-bound features that need to share types with client components.
