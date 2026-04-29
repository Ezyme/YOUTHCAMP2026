# infrastructure — Middleware, build configs

Top-level configuration: middleware (camp + admin gating), Next.js config, ESLint, PostCSS/Tailwind. The plumbing that makes everything else work.

## What lives in this folder

- [middleware.ts](../../middleware.ts) — Edge middleware enforcing camp + admin gates on `/camp/*`, `/play/*`, `/admin/*`.
- [next.config.ts](../../next.config.ts) — Next.js config (currently empty).
- [eslint.config.mjs](../../eslint.config.mjs) — ESLint flat config, extends `eslint-config-next`.
- [postcss.config.mjs](../../postcss.config.mjs) — Tailwind v4 plugin via PostCSS.

## Docs in this folder

| File | What it covers |
|---|---|
| [architecture.md](./architecture.md) | Middleware matchers, Edge runtime constraints |
| [frontend.md](./frontend.md) | _N/A_ |
| [backend.md](./backend.md) | What middleware does, what it does not |
| [api.md](./api.md) | _N/A_ |
| [rules.md](./rules.md) | Edge runtime imports, gate stays optional, never gate `/api/admin/*` from middleware |
| [patterns.md](./patterns.md) | Matcher format, env-driven gate, redirect with `next` param |
| [recipes.md](./recipes.md) | Gate a new path, add Next.js config option, change ESLint rules |
| [env.md](./env.md) | `ADMIN_SECRET`, `CAMP_LOGIN_PASSWORD`, `CAMP_REQUIRE_LOGIN` |
| [gotchas.md](./gotchas.md) | Edge runtime can't import server-only modules, matcher prefix issues |

## Related domains

- [camp-auth](../camp-auth/README.md) — middleware reads `CAMP_AUTH_COOKIE` and `isCampGateEnabled`.
- [admin](../admin/README.md) — middleware enforces admin cookie on `/admin/*`.
