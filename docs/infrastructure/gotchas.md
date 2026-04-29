# infrastructure — gotchas

## 1. Importing a server-only module crashes the build

Adding `import { dbConnect } from "@/lib/db/connect"` to middleware crashes Next.js's build with an Edge runtime error. Mongoose can't run in V8 isolates.

If you need DB-aware logic in middleware, you'd have to call your own API endpoint via `fetch` from middleware (slow) or do the check at the page/handler level instead.

## 2. Matcher misses bare paths without `:path*`

```ts
matcher: ["/admin/:path*"]   // ✗ misses /admin (no slash)
matcher: ["/admin", "/admin/:path*"]  // ✓
```

Always include both. Without the bare path, hitting `/admin` (which Next.js treats as a folder index) skips middleware.

## 3. `/api/admin/*` is NOT in the matcher

Middleware doesn't gate API routes. The matcher pattern is for pages. Admin API handlers must call `verifyAdminRequest()` themselves. See [admin/architecture.md](../admin/architecture.md).

## 4. `ADMIN_SECRET` unset = admin open in middleware AND in handlers

Both [middleware.ts:36-38](../../middleware.ts#L36-L38) and [lib/admin-auth.ts:6-7](../../lib/admin-auth.ts#L6-L7) treat unset as pass-through. Production deploys without `ADMIN_SECRET` set leave admin wide open. CI / deployment checks should fail when this is missing.

## 5. The matcher only triggers middleware — it doesn't filter routes

A path matched by the matcher and a path that exists as a Next.js route are independent concerns. The matcher just says "run middleware on this URL pattern". The routing happens after middleware decides to pass through.

So `/dashboard/:path*` in the matcher without a corresponding `app/dashboard/` directory means middleware runs on every `/dashboard/foo` request and ultimately Next.js 404s. Add the route or remove the matcher.

## 6. Soft-nav doesn't always trigger middleware

Next.js's client-side router can sometimes serve a cached RSC payload without hitting middleware. In practice this is rare for gated routes — RSC fetches still go through the server. But if a future caching change introduces stale-while-revalidate, gated routes might briefly render before the gate kicks in.

If you see "I'm logged out but still see /admin briefly", investigate whether RSC is caching past the cookie change.

## 7. Tailwind v4 syntax differs from v3

No `tailwind.config.js`. Theme is in CSS via `@theme`. Plugin chain is in `postcss.config.mjs`. If you copy v3 patterns from another project, they won't apply.

If a v3 utility class isn't working, check whether v4 dropped or renamed it. The migration guide is in `node_modules/tailwindcss/CHANGELOG.md`.

## 8. ESLint flat config defaults aren't compatible with `package.json`'s `eslintIgnore`

The `eslintIgnore` field in package.json is ignored by the flat config. We declare ignores via `globalIgnores` in [eslint.config.mjs](../../eslint.config.mjs). Don't rely on `package.json`'s `eslintIgnore`.

## 9. `next.config.ts` is empty — adding the wrong export crashes the build

If you accidentally export `module.exports` instead of `export default`, the build fails with a cryptic error. Use `export default nextConfig`.

## 10. Edge runtime has no `fs`, `path`, `Buffer` (full version)

Some npm packages assume Node APIs. Pulling them into middleware silently fails or build-time errors. Stick to libraries that explicitly support Edge — `bcryptjs` does NOT (it uses Node `crypto`); we use it in API handlers (Node runtime), not middleware.

## 11. Setting `runtime: "edge"` on an API route changes its capabilities

Today no API route opts into Edge. They're all Node runtime by default. If you ever set `export const runtime = "edge";` on a route, it becomes Edge-restricted (no Mongoose, no bcryptjs). Don't, unless you have a specific reason.

## 12. `request.nextUrl.search` includes the leading `?`

```ts
login.searchParams.set("next", pathname + request.nextUrl.search);
```

For `/play/unmasked?teamId=X`, this builds `next=/play/unmasked?teamId=X`. The leading `?` is preserved by `searchParams.set` — verified.

If you ever change to `request.nextUrl.searchParams.toString()`, you'd lose the `?`. Test the redirect target.
