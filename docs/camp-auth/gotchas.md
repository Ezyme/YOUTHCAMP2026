# camp-auth — gotchas

## 1. Soft-nav can lose the fresh cookie

**Symptom:** Right after a successful login, navigating with `router.push(next)` instead of `window.location.assign(next)` can land on `/play/unmasked` and immediately see "Login required" 401s on the API calls.

**Cause:** The login response set the cookie via `Set-Cookie`, but the next React Server Component fetch is sometimes initiated before the browser commits the cookie to its store. Soft-nav goes through Next's RSC streaming path and the cookie isn't always attached on the first render.

**Fix:** [`camp-login-form.tsx:33`](../../app/login/camp-login-form.tsx#L33) uses `window.location.assign(next)` — full navigation. The browser commits cookies before issuing the new GET. The button comment notes this is to "avoid soft-nav edge cases".

If you ever refactor this, keep the full-nav approach.

## 2. `/api/camp/login` succeeds without checking creds when the gate is off

When `isCampGateEnabled()` returns false, the route ([login route:23-35](../../app/api/camp/login/route.ts#L23-L35)) sets `youthcamp_camp_auth=1` regardless of body content. This is a **feature**, not a bug — local dev relies on it. But in production with a misconfigured env, the gate could silently turn off and accept every login as a no-op.

**Mitigation:**
- Verify `CAMP_REQUIRE_LOGIN=1` is set in your production env before deployment.
- The login route does not also set `youthcamp_team_id` when the gate is off, so game routes still demand a team cookie. That's an accidental safety net — don't rely on it.

## 3. `/api/camp/select-team` does not validate session membership

The route accepts any valid ObjectId and writes it to the cookie ([select-team:9-19](../../app/api/camp/select-team/route.ts#L9-L19)). It does not check that the team exists or belongs to the current session.

**Why this is fine today:** The dashboard/analytics callers always filter by session id. A stale team cookie just returns empty data.

**When this would bite:** If you ever add a route that trusts the team cookie identity without re-validating in the active session — e.g. "submit a score for the team in your cookie" — that route would accept a forged team id. Always validate the team belongs to the active session before writing.

## 4. The two camp cookies are independent

Logging out clears both. Switching teams updates only `youthcamp_team_id`. **Logging in always re-sets both.** If you only set the auth cookie (e.g. via a custom flow), routes that need team identity will redirect or 401. Don't try to "fix" this by inferring the team from the username — the team picker on the dashboard expects the cookie to win.

## 5. Cookie `value === "1"`, not "is the cookie set"

```ts
const ok = jar.get(CAMP_AUTH_COOKIE)?.value === "1";
```

A cookie value of `"true"` or `""` does NOT pass the gate. This is intentional — the literal `"1"` is what `/api/camp/login` writes, and equality keeps the gate strict if anyone ever guesses the cookie name and sets a custom value.

## 6. Camp gate doesn't gate `/api/admin/*`

Middleware only intercepts `/admin/*` page routes — not `/api/admin/*`. Each admin API handler must call `verifyAdminRequest()` itself. See [admin/architecture.md](../admin/architecture.md).

This isn't a camp-auth bug, but it's the kind of thing people assume incorrectly when reading `middleware.ts`. **Camp auth never gates anything under `/api/`** — it gates pages.

## 7. `safeCampLoginNext` rejects URL-encoded slashes the wrong way (subtle)

The guard does:
```ts
try { s = decodeURIComponent(s); } catch { return DEFAULT; }
```

A double-encoded `next` like `%2F%2Fevil.com` decodes once to `//evil.com` — which the next check `s.startsWith("//")` rejects. So it's safe. But this is the kind of code that needs unit tests if it ever grows. Today it's compact enough to scan visually, and there are no encoded variants of `://` that would slip past the literal check.

## 8. Team password stored once, no rotation history

`Team.passwordHash` is overwritten by every seed run / bulk update. There's no audit log. If someone asks "when was the password last rotated", the only answer is the `Team.updatedAt` field — and that bumps for unrelated reasons (e.g. renaming the team). For a youth camp this is fine; if it isn't, you've outgrown the model.

## 9. Logout is a no-op for unauthenticated callers

`POST /api/camp/logout` always returns 200, even with no cookies. It just calls `cookies.delete()` which is a no-op for missing cookies. Safe for double-clicks and stale sessions.

## 10. The dashboard initial render comes from SSR; team switch is client-only

[`/camp/page.tsx`](../../app/camp/page.tsx) fetches initial analytics on the server. After that, the team-picker calls `/api/camp/analytics` from the client, then `router.refresh()` to sync SSR. If you change SSR-only data shape (e.g. add a field to `getComebackAnalytics`), make sure both the server initial fetch **and** the API response include it — they share `comeback.types.ts` types but separate fetch paths.
