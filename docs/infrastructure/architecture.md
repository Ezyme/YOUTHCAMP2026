# infrastructure — architecture

## Middleware ([middleware.ts](../../middleware.ts))

Runs in Next.js's Edge runtime before every request matched by `config.matcher`. Three concerns, in order:

### 1. `/play/*` — camp gate (optional)

```ts
const isPlayRoute = pathname === "/play" || pathname.startsWith("/play/");
if (isPlayRoute && isCampGateEnabled()) {
  if (cookies.get(CAMP_AUTH_COOKIE)?.value !== "1") {
    redirect to /login?next=<pathname+query>
  }
}
```

If the camp gate is disabled (`CAMP_REQUIRE_LOGIN` unset/disabled), `/play/*` is open.

### 2. `/camp/*` — camp gate (optional)

Same logic. The dashboard `/camp` and any sub-path require the gate cookie when the gate is on.

### 3. `/admin/*` — admin gate

Always enforced when `ADMIN_SECRET` is set (regardless of `CAMP_REQUIRE_LOGIN`). The login page itself (`/admin/login`) is exempt.

```ts
if (!ADMIN_SECRET) → pass through (dev convenience)
if (cookie value !== ADMIN_SECRET) → redirect /admin/login?next=<pathname>
```

### What middleware does NOT gate

- **`/api/*`** — middleware doesn't see API routes. Each API handler must enforce its own auth (camp routes call `requireAuth`; admin routes call `verifyAdminRequest`).
- **`/`, `/games`, `/games/*`, `/leaderboard`, `/login`** — public.

## Matcher

```ts
matcher: ["/camp", "/camp/:path*", "/play", "/play/:path*", "/admin", "/admin/:path*"]
```

Includes the bare path AND `:path*` for sub-routes. Without both, `/admin` (no trailing slash) wouldn't match. The `:path*` syntax is Next.js's convention.

`/api/admin/*` is **NOT** in the matcher — see [admin/architecture.md](../admin/architecture.md). Each admin API handler needs its own check.

## Edge runtime constraints

Middleware runs in V8 isolates (no Node APIs). What you can NOT import:
- `mongoose` (uses Node's `crypto`, `dns`, `tls`)
- `next/headers` `cookies()` async helper that requires Node — you use `request.cookies` instead
- Most `lib/db/*`, `lib/seed/*`, `lib/games/*` modules

What you CAN import:
- `lib/camp/auth.ts` — pure (no DB, no Node imports)
- TypeScript types
- `next/server` exports (`NextResponse`, `NextRequest`)

If you need to call DB-aware logic from middleware, you'd have to call your own API endpoint — not import the lib directly.

## Next.js config — [next.config.ts](../../next.config.ts)

Currently empty:
```ts
const nextConfig: NextConfig = {};
export default nextConfig;
```

No experimental flags, no rewrites, no headers, no image domains. The default Next.js 16 behavior is in effect.

## ESLint — [eslint.config.mjs](../../eslint.config.mjs)

Flat config. Extends:
- `eslint-config-next/core-web-vitals`
- `eslint-config-next/typescript`

Overrides `globalIgnores` (the defaults) — explicitly ignores `.next/**`, `out/**`, `build/**`, `next-env.d.ts`. The override is needed because the previous syntax (`eslintIgnore` field in `package.json`) doesn't apply when using flat config.

## PostCSS — [postcss.config.mjs](../../postcss.config.mjs)

Wires Tailwind v4 via the official `@tailwindcss/postcss` plugin. Tailwind v4 changes its config to be inside the CSS file (via `@theme`), not in a separate `tailwind.config.js`. Don't add a v3-style config file.

## Layer position

```
[Browser] → middleware.ts (edge, every matched request)
                │
                ├── camp gate check → redirect /login or pass
                ├── admin gate check → redirect /admin/login or pass
                ▼
[Next.js routing] → page or API route
```
