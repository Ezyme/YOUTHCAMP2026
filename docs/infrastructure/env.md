# infrastructure — env

The middleware reads three env vars. Each is documented in detail in its owning domain.

| Variable | Owning domain | Used in middleware for |
|---|---|---|
| `ADMIN_SECRET` | [admin/env.md](../admin/env.md) | Admin gate enable + cookie value comparison |
| `CAMP_LOGIN_PASSWORD` | [camp-auth/env.md](../camp-auth/env.md) | Legacy: any non-empty value enables the camp gate |
| `CAMP_REQUIRE_LOGIN` | [camp-auth/env.md](../camp-auth/env.md) | Canonical camp gate switch |

## How middleware reads them

- `ADMIN_SECRET` — read directly via `process.env.ADMIN_SECRET` ([middleware.ts:35](../../middleware.ts#L35)).
- The two camp-related vars are read indirectly via `isCampGateEnabled()` from `@/lib/camp/auth`. Don't read them directly in middleware — go through the helper.

## Edge runtime env access

Edge middleware can read `process.env.*` for variables Next.js inlines at build time. **Public env vars** (prefixed `NEXT_PUBLIC_*`) are always inlined. **Private env vars** are inlined for middleware specifically — Next.js bundles them into the Edge function.

The three vars above are private; they're inlined for middleware at build. You can verify by inspecting the `.next/server/middleware.js` output.

If you change env values, **restart the dev server** — middleware won't re-read at runtime.

## Production deployment checklist

```dotenv
# Required
MONGODB_URI=mongodb+srv://...
ADMIN_SECRET=<long-random>

# Strongly recommended for production
CAMP_REQUIRE_LOGIN=1
TEAM_SEED_PASSWORD=<camp-password>

# For media uploads
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

Without `ADMIN_SECRET`, admin is open. Without `CAMP_REQUIRE_LOGIN`, anyone can play. Both deployments have legitimate use cases (private staging, public showcase) but verify intent before going live.
