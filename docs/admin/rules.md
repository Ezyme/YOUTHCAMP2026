# admin — rules

## MUST

- **Every `/api/admin/*` handler must call `verifyAdminRequest()` before any other work.** Middleware does not gate `/api/admin/*` — only `/admin/*` page routes. Skipping this check leaves the route open.
- **Set `ADMIN_SECRET` in production.** The unset path returns true from `verifyAdminRequest()` and bypasses gating in middleware. Treat it as dev-only behavior.
- **Use `plainGameScoring()`** when passing `GameDefinition.scoring` to a Client Component. Mongoose subdoc internals (e.g. `_id` buffers) trip React's server-to-client serialization.
- **Match the response shape used by sibling admin routes.** `verifyAdminRequest` failure → `{ error: "Unauthorized" }, 403` (not 401 — admin uses 403 by convention; camp routes use 401).
- **Use `dynamic = "force-dynamic"`** on every admin panel page. Admin views must never be cached — they reflect live state.
- **Place new panel pages under `app/admin/(panel)/`** so they inherit the sidebar layout. Pages outside the group don't get the sidebar (only `/admin/login` should be outside).
- **Always wrap reset/destructive actions in a confirm flow on the client.** `<ResetCampButton>` uses a `confirm()`-style guard — match that pattern for any new destructive action.

## MUST NOT

- **Never trust middleware alone for API auth.** Middleware only matches `/admin/:path*` for pages.
- **Never set the `youthcamp_admin` cookie value to anything other than `ADMIN_SECRET` itself.** Both middleware and `verifyAdminRequest` compare `cookie.value === secret` directly. Any derived token / hash will silently reject every request.
- **Never use the camp cookie (`youthcamp_camp_auth`) to authorize admin actions.** They are separate systems. A team-logged-in user is not an admin.
- **Never duplicate the cookie name string.** It's currently hardcoded in four places (lib/admin-auth, middleware, /api/admin/login route, site-header). When you rename, change all four. (Better: extract a constant — see [recipes.md](./recipes.md) and [gotchas.md](./gotchas.md).)
- **Never add a new admin write endpoint under `/api/admin/*` without `verifyAdminRequest()`.** It's the single point of truth for "is the caller an admin".
- **Never bypass `resetUnmaskedBoardKeepTimer` / engine helpers** when manipulating Unmasked state from admin. The helpers preserve invariants (timer, redeemed codes, bonus hearts) that ad-hoc updates miss.
- **Never log `ADMIN_SECRET` or the `youthcamp_admin` cookie value.** They're both literally the secret — don't put them in console output, error pages, or telemetry.
