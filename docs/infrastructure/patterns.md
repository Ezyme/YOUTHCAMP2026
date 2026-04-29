# infrastructure — patterns

## 1. Matcher includes both bare and `:path*`

```ts
matcher: ["/admin", "/admin/:path*"]
```

Bare path matches `/admin`. `:path*` matches `/admin/games`, `/admin/login`, etc. Without both, hitting `/admin` (no trailing slash) wouldn't trigger middleware.

## 2. Env-driven optional gate

```ts
if (isCampGateEnabled()) { /* enforce */ }
```

The gate is a runtime decision, not compile-time. `CAMP_REQUIRE_LOGIN` controls behavior without redeploys. Same pattern for `ADMIN_SECRET` — unset means "dev mode, gate off".

## 3. Redirect with `next` query param

```ts
const login = new URL("/login", request.url);
login.searchParams.set("next", pathname + request.nextUrl.search);
return NextResponse.redirect(login);
```

`new URL("/login", request.url)` builds an absolute URL using the current host. `searchParams.set` adds the redirect target. The login page (camp or admin) reads `next` and validates via `safeCampLoginNext` (camp) or trusts it (admin — possible improvement).

## 4. Skip-paths early-return inside the gate block

```ts
if (pathname.startsWith("/admin/login")) {
  return NextResponse.next();
}
```

Inside the admin block, `/admin/login` short-circuits before the cookie check. Otherwise the login page would redirect-loop.

## 5. `isPlayRoute` boolean before the gate check

```ts
const isPlayRoute = pathname === "/play" || pathname.startsWith("/play/");
if (isPlayRoute && isCampGateEnabled()) { ... }
```

Cleaner than re-checking the path inside the conditional. The pattern is mirrored for `/camp/*`.

## 6. Pure imports only in middleware

`@/lib/camp/auth` is the only `@/lib/*` import. It's intentionally pure — no `mongoose`, no Node-only deps. If you create more pure helpers, name them clearly so future authors know they're Edge-safe (e.g. `lib/camp/auth.ts` is fine; `lib/camp/team-game-access.ts` is NOT — it imports `dbConnect`).

## 7. Flat ESLint config

Modern ESLint flat config in [eslint.config.mjs](../../eslint.config.mjs). The `defineConfig` helper from `eslint/config` provides type hints. Plugins extend via `...nextVitals`/`...nextTs` spread.

## 8. Tailwind v4 CSS-only config

No `tailwind.config.js`. Tailwind v4 reads from `@theme` blocks in `globals.css`. PostCSS just routes the CSS through the Tailwind plugin.

If you ever need v3-style theme overrides, add them as `@theme` in CSS — not a JS config file.
