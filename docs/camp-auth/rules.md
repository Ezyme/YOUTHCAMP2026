# camp-auth — rules

## MUST

- **Always import `CAMP_AUTH_COOKIE` and `CAMP_TEAM_COOKIE`** from `@/lib/camp/auth`. Never hardcode the strings in route handlers, components, or middleware.
- **Always use `safeCampLoginNext(rawNext)`** before redirecting to a `next` query param. Never insert `next` into `redirect()` / `window.location.assign` directly.
- **Always set cookies as `httpOnly + sameSite: 'lax' + path: '/' + maxAge`**. The login route is the canonical pattern.
- **Always check `isCampGateEnabled()` rather than reading env vars directly** in routes. The gate logic is non-trivial and has a back-compat path for `CAMP_LOGIN_PASSWORD`.
- **Always select `+passwordHash` explicitly** when comparing passwords. The field is `select: false`.
- **Always require `youthcamp_camp_auth=1` (cookie === literal '1')**, not "is the cookie set". A different value means somebody is poking at it.
- **Always use `requireCampTeamForGameRoute` / `loadCampTeamScoredGames`** in SSR pages that need a team. Don't reimplement the team-cookie + session-validate dance.
- **Always treat the gate-off path as production-untrusted.** When the gate is off, anyone can call `/api/camp/login` and obtain the auth cookie. Don't expose admin-only endpoints under camp auth thinking the gate protects them.

## MUST NOT

- **Never** include `passwordHash` in any response body. The schema's `select: false` protects you on `find()` calls; explicit `.select('+passwordHash')` reads must be assigned to a non-leaked variable and never serialized.
- **Never** accept a `next` redirect target without `safeCampLoginNext`. Open-redirect = phishing vector.
- **Never** use the camp cookie to gate **admin** routes. They are separate cookies (`youthcamp_admin`) — see [admin/rules.md](../admin/rules.md).
- **Never** verify credentials in `/api/camp/select-team`. The team picker is a UI affordance; the gate cookie is the auth proof.
- **Never** assume the gate is on. Local dev runs without it. Code that needs auth identity should explicitly check `isCampGateEnabled()` and the cookie value.
- **Never** rotate `CAMP_AUTH_COOKIE` or `CAMP_TEAM_COOKIE` names without coordinating: middleware reads them, every camp/game route reads them, and the SSR gate logic in `site-header.tsx` reads them. Renaming requires touching all four places.
- **Never** persist anything sensitive on `Team` other than the bcrypt hash. There's no per-user account model.
- **Never** add a `select-team` style route that flips identity without re-checking auth in a future scenario where teams have privacy from each other. Today they don't — but if they ever do, that pattern needs to change.
