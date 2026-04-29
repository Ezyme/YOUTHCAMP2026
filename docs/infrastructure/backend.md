# infrastructure — backend

## Middleware behavior

[Source](../../middleware.ts).

```ts
export function middleware(request: NextRequest) {
  // 1. /play/* check (camp gate)
  // 2. /camp/* check (camp gate)
  // 3. /admin/* check (admin gate, /admin/login exempt)
  return NextResponse.next();
}

export const config = {
  matcher: ["/camp", "/camp/:path*", "/play", "/play/:path*", "/admin", "/admin/:path*"],
};
```

### Camp gate (`/play/*` and `/camp/*`)

Calls `isCampGateEnabled()` from `@/lib/camp/auth`. If false → pass-through. If true → require `youthcamp_camp_auth=1` cookie. Missing cookie → 307 redirect to `/login?next=<pathname>`.

The `/play/*` redirect preserves the query string in `next` (e.g. `/play/unmasked?teamId=...`). The `/camp/*` redirect preserves only the pathname.

### Admin gate (`/admin/*`)

Skip if pathname starts with `/admin/login`. Otherwise:
- If `ADMIN_SECRET` unset → pass-through (dev convenience).
- If cookie matches → pass.
- Else → 307 redirect to `/admin/login?next=<pathname>`.

The redirect target uses pathname only (no query). If you need the query, change [middleware.ts:41](../../middleware.ts#L41).

## Pure imports only

The middleware module imports:
```ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { CAMP_AUTH_COOKIE, isCampGateEnabled } from "@/lib/camp/auth";
```

`@/lib/camp/auth` is pure — it doesn't import `mongoose` or any Node API. Don't import other lib modules into middleware unless you've audited them for Edge compatibility.

## Next.js config

[next.config.ts](../../next.config.ts) is empty. To add:
- **`reactStrictMode`** (default true in Next 16)
- **`experimental.*`** flags (rare; document why)
- **`headers()`** for security headers
- **`rewrites()`** for path aliasing
- **`images.domains`** if `<Image>` uses external sources

Cloudinary URLs are used in `<img>` tags (not `<Image>`), so no `images.domains` config is needed today.

## ESLint config

Flat config style ([eslint.config.mjs](../../eslint.config.mjs)). Extends `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`. The `globalIgnores` override is intentional — Next's defaults ignore `.next/**` etc., but flat config requires them to be re-declared.

To add custom rules:

```js
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([...]),
  {
    rules: {
      "no-console": "warn",
      // ...
    },
  },
]);
```

## PostCSS config

[postcss.config.mjs](../../postcss.config.mjs) is one plugin: `@tailwindcss/postcss`. Tailwind v4 internalizes its config into CSS (`@theme` blocks). Don't add a `tailwind.config.js` — that's v3 syntax.
