# admin — env

| Variable | Required | Effect |
|---|---|---|
| `ADMIN_SECRET` | **yes in production** | Single shared password for all admin actions |

## `ADMIN_SECRET`

Read by:
- [middleware.ts:35](../../middleware.ts#L35) — gates `/admin/*` page routes
- [lib/admin-auth.ts:5](../../lib/admin-auth.ts#L5) — `verifyAdminRequest()` for `/api/admin/*` routes
- [/api/admin/login/route.ts:5](../../app/api/admin/login/route.ts#L5) — login validation + cookie value
- [components/site-header.tsx:12](../../components/site-header.tsx#L12) — toggles "Admin" link visibility
- [/api/seed/route.ts:9](../../app/api/seed/route.ts#L9) — optional auth on seed (header `x-admin-secret` or body `secret`)

### Behavior when set

- Middleware enforces `youthcamp_admin === <secret>` cookie on `/admin/*`.
- API admin handlers return 403 unless cookie matches.
- The cookie value **is** the secret literally — when set, the cookie carries the secret value.
- Header link is hidden unless the user is already authed.

### Behavior when **unset**

**Admin is open.** Both middleware and `verifyAdminRequest()` short-circuit return true / pass-through. Admin pages render directly; admin APIs accept any caller.

This is intentional dev convenience — local devs don't need to set the secret. **Never deploy without it.** A misconfigured production env (env var missing or empty after trim) leaves admin completely unprotected. CI / deploy checks should fail when `ADMIN_SECRET` is empty.

### Choosing a value

Use a long, random string (32+ chars). Examples:
- `openssl rand -hex 32` → `4fa3...`
- 1Password / Bitwarden generated password

Don't reuse existing passwords. Don't use anything memorable — the secret travels in the cookie value, so memorability has no benefit and obscurity helps.

### Storage

- **Local dev**: `.env.local` (gitignored). Optional.
- **Production**: platform secret store (Vercel / Fly.io / etc.). Required.

### Rotation

See [recipes.md](./recipes.md#recipe-rotate-admin_secret). Rotation invalidates all existing admin cookies; everyone re-logs.

## What does **not** belong here

- `MONGODB_URI` — see [db/env.md](../db/env.md)
- `CAMP_REQUIRE_LOGIN`, `CAMP_LOGIN_PASSWORD`, `TEAM_SEED_PASSWORD` — see [camp-auth/env.md](../camp-auth/env.md)
- `CLOUDINARY_*` — see [media-uploads/env.md](../media-uploads/env.md)
