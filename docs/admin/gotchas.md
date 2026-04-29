# admin — gotchas

## 1. `ADMIN_SECRET` unset = admin is wide open

Both [middleware.ts:35-38](../../middleware.ts#L35-L38) and [lib/admin-auth.ts:6-7](../../lib/admin-auth.ts#L6-L7) treat an unset (or whitespace-only) `ADMIN_SECRET` as "no auth required". This is by design for local dev — but it means a misconfigured production env exposes everything.

**Mitigation:** Verify the env var is set in production. A simple check at boot would be defensive — e.g. throw in `middleware.ts` if `NODE_ENV === "production" && !process.env.ADMIN_SECRET`. Not currently in code.

## 2. Middleware does NOT gate `/api/admin/*`

[middleware.ts:48-57](../../middleware.ts#L48-L57) matcher:
```ts
matcher: ["/camp", "/camp/:path*", "/play", "/play/:path*", "/admin", "/admin/:path*"]
```

`/api/admin/...` is NOT in there — Next.js treats `/api/...` as a separate prefix and matchers don't recurse into nested API routes. **Every `/api/admin/*` handler must call `verifyAdminRequest()` itself.**

If you forget, the route is open to anyone who can hit the URL. Today every handler does the check; CI / lint can't catch a missing one. Code review responsibility.

## 3. The cookie name is hardcoded in four places

`"youthcamp_admin"` appears in:
- [lib/admin-auth.ts:8](../../lib/admin-auth.ts#L8)
- [middleware.ts:39](../../middleware.ts#L39)
- [/api/admin/login/route.ts:14](../../app/api/admin/login/route.ts#L14)
- [components/site-header.tsx:13](../../components/site-header.tsx#L13)

Renaming requires touching all four. There's no exported constant. See [recipes.md](./recipes.md#recipe-extract-the-cookie-name-to-a-constant) for the safest extraction path.

This is inconsistent with camp-auth, which exports `CAMP_AUTH_COOKIE` from `lib/camp/auth.ts`.

## 4. Admin panel relies on public-namespaced mutation routes

`/api/games`, `/api/teams`, `/api/teams/[id]`, `/api/game-results`, `/api/unmasked/codes`, `/api/cloudinary/upload` are all called by admin panels but are **not admin-namespaced and don't check admin auth**.

In the current threat model (camp-internal use, casual trust) this is acceptable but surprising. If you assume "URL contains `/admin/`" means "admin-protected", you're wrong for these endpoints. See [models.md](./models.md#cross-domain-notes) and [rules.md](./rules.md).

## 5. Login uses soft-nav, camp uses full-nav

Admin's [`<AdminLoginForm>`](../../app/admin/login/login-form.tsx) uses `router.push(next)`. Camp's [`<CampLoginForm>`](../../app/login/camp-login-form.tsx) uses `window.location.assign(next)`. Why the difference?

The admin cookie is set by the `/api/admin/login` response that the form awaits. By the time `router.push` fires, the browser has already committed the cookie. Soft-nav works.

Camp had soft-nav edge cases where the team cookie wasn't read on the next request — see [camp-auth/gotchas.md](../camp-auth/gotchas.md#1-soft-nav-can-lose-the-fresh-cookie). Different fix because of the routing differences.

If you ever see admin login "succeed but the next page redirects you back to login", switch to `window.location.assign` here too.

## 6. `verifyAdminRequest` returns `true` on missing secret — easy to misread

```ts
const secret = process.env.ADMIN_SECRET?.trim();
if (!secret) return true;          // <-- looks like a bug at first glance
```

This is intentional and matches the middleware behavior. Don't "fix" it by returning false.

## 7. `/api/seed` accepts `body.secret` OR `x-admin-secret` header

[seed route:9-15](../../app/api/seed/route.ts#L9-L15) accepts the secret two ways:
- HTTP header `x-admin-secret`
- POST body field `secret`

If `ADMIN_SECRET` is set, it requires one to match. If unset, no check. The dual-channel exists because the dashboard's `<SeedButton>` posts an empty body and relies on the cookie path, but external tools (curl) tend to use headers or body. The cookie isn't checked on `/api/seed` directly because seed pre-dates the admin cookie.

If you ever rotate the secret, callers using header/body must update too.

## 8. Reset-camp does not clear `PowerUpCode` rows

`/api/admin/reset-camp` clears `redeemedBy` on existing `PowerUpCode` rows, but does NOT delete the rows themselves. After a reset, the same codes are still valid for new redemption. This is the right behavior — you don't want to reprint Amazing Race code cards every camp run — but it's surprising if you read the route name as "wipe everything".

To delete codes, do it from `/admin/power-ups` page individually (`DELETE /api/unmasked/codes?id=...`).

## 9. `(panel)` route group is silent if you mistype it

Next.js parenthesized route groups (`(panel)`) don't appear in URLs. If you mistype as `(panl)`, the page still works — but the file is in a different group, so it won't inherit the panel layout's sidebar. Symptoms: page renders bare, no sidebar.

Always copy from existing panel pages and verify the path is exactly `app/admin/(panel)/...`.

## 10. `dynamic = "force-dynamic"` is needed on every panel page

If you forget it, the page may be statically optimized at build time and serve stale data. Symptom: "I added a team but it doesn't show up in the admin teams page until I hard-refresh." Add the export.

## 11. Cookie maxAge: admin = 7 days, camp = 14 days

Different expiry windows (admin 7d, camp 14d) — not a bug, just a choice. Admin sessions are intentionally shorter. If consolidating, both should be configurable.
