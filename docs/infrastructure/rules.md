# infrastructure — rules

## MUST

- **The middleware must remain pure / Edge-compatible.** Only import modules that don't pull in `mongoose`, `next/headers` async cookies, or Node-only APIs. Currently safe imports: `next/server`, `@/lib/camp/auth`, type-only imports.
- **Always update the matcher when adding a new gated path.** A path not in the matcher is invisible to middleware.
- **Always include both `/x` and `/x/:path*`** in the matcher when you want to gate a path and its sub-routes.
- **Always treat `ADMIN_SECRET` unset as a dev convenience, not a deployment mode.** Production deploys must set the secret.
- **Always exempt `/admin/login`** from the admin gate. Otherwise users get an infinite redirect loop on first visit.
- **Always redirect with `307` (default for `NextResponse.redirect`)** so the method is preserved if the user came from a POST. Today the matched routes are GETs, so this rarely matters — but keep it.

## MUST NOT

- **Never import server-only modules into middleware.** `mongoose`, `next/headers` cookies, `bcryptjs`, anything that uses Node `crypto` or `fs`. The Edge runtime crashes at build time.
- **Never put `/api/*` in the matcher.** API routes need per-handler auth checks, not edge gates. Forcing API routes through middleware breaks the camp + admin route handlers' own logic.
- **Never gate `/api/admin/*` from middleware.** Each admin handler must call `verifyAdminRequest()`.
- **Never inline raw cookie names** in middleware. Import `CAMP_AUTH_COOKIE` from `@/lib/camp/auth`. (Admin cookie name is currently a literal — see [admin/gotchas.md](../admin/gotchas.md).)
- **Never make the camp gate non-optional.** Local dev relies on `CAMP_REQUIRE_LOGIN` being unset.
- **Never add Tailwind v3-style config (`tailwind.config.js`).** v4 uses CSS-internal config via `@theme`.
- **Never disable ESLint globally.** If a rule is wrong, override per-rule. Disabling makes regressions invisible.
- **Never skip pre-commit hooks** (`--no-verify`) when the repo has them. The CLAUDE.md hard rules require not bypassing.
