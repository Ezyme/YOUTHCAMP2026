# infrastructure — recipes

## Recipe: gate a new path

E.g. add `/dashboard/*` behind the camp gate.

1. **Add to the matcher** in [middleware.ts:48-57](../../middleware.ts#L48-L57):
   ```ts
   matcher: [
     "/camp", "/camp/:path*",
     "/play", "/play/:path*",
     "/dashboard", "/dashboard/:path*",  // new
     "/admin", "/admin/:path*",
   ],
   ```
2. **Add the gate logic** inside the middleware function:
   ```ts
   const isDashboard = pathname === "/dashboard" || pathname.startsWith("/dashboard/");
   if (isDashboard && isCampGateEnabled()) {
     const ok = request.cookies.get(CAMP_AUTH_COOKIE)?.value === "1";
     if (!ok) {
       const login = new URL("/login", request.url);
       login.searchParams.set("next", pathname);
       return NextResponse.redirect(login);
     }
   }
   ```
3. Test with the gate ON: visit `/dashboard` while logged out → should redirect to `/login?next=/dashboard`.

## Recipe: add a Next.js config option

Edit [next.config.ts](../../next.config.ts):

```ts
const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    /* if you need feature flags */
  },
};
```

Restart the dev server for new options to take effect.

For external image domains (when using `<Image>`):
```ts
images: { remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }] }
```

Today we use `<img>` not `<Image>` so this isn't needed. If switching to Next.js's image component, add the Cloudinary domain.

## Recipe: add a custom ESLint rule

Edit [eslint.config.mjs](../../eslint.config.mjs):

```js
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([...]),
  {
    rules: {
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
]);
```

Run `npm run lint` to verify.

## Recipe: add security headers

Add a `headers()` async function in `next.config.ts`:

```ts
async headers() {
  return [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "X-Frame-Options", value: "DENY" },
      ],
    },
  ];
},
```

Restart server. Verify in browser dev tools → Network → request headers.

## Recipe: change the default redirect target after login

Currently the login form redirects to `next` query param (or `/camp` default for camp, `/admin` for admin). To change the default for camp:

1. Edit [`safeCampLoginNext`](../../lib/camp/auth.ts) — change `DEFAULT_LOGIN_REDIRECT`.
2. The middleware's redirect URL doesn't change — it always sets `next` to the requested path. The default only applies when `next` is missing.

## Recipe: support `/admin/*` query string preservation in the redirect

Today admin redirect uses pathname only:
```ts
login.searchParams.set("next", pathname);
```

To include the query:
```ts
login.searchParams.set("next", pathname + request.nextUrl.search);
```

Match the camp `/play/*` behavior.

## Recipe: gate `/api/admin/*` from middleware (instead of per-handler)

This would change the auth model:

1. Add `/api/admin/:path*` to the matcher.
2. Inside middleware, check the admin cookie. On miss, return `NextResponse.json({ error: "Unauthorized" }, { status: 403 })` instead of redirecting.

Trade-off: admin handlers can drop their `verifyAdminRequest()` calls. But middleware now produces JSON for some matches and redirects for others — coupling content type to path. The current per-handler approach is cleaner.

If you do this, also change `verifyAdminRequest` callers to no-op or delete them.

## Recipe: add a route-rewriting redirect

E.g. forward `/old-path` to `/new-path`:

```ts
async redirects() {
  return [{ source: "/old-path", destination: "/new-path", permanent: true }];
},
```

Different from middleware: redirects in `next.config.ts` are static and apply at the edge before any code runs. Middleware redirects are dynamic.
