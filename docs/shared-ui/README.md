# shared-ui — Layout, theming, header, toasts, root assets

Cross-cutting UI: the root layout, the site header, theme provider, mobile nav, toast helpers, the home page, global CSS, manifest, and favicon.

## What lives in this folder

- [app/layout.tsx](../../app/layout.tsx) — root layout (`<html>`, fonts, theme provider, toaster)
- [app/page.tsx](../../app/page.tsx) — home page (`/`)
- [app/globals.css](../../app/globals.css) — Tailwind v4 entry + custom utilities
- [app/manifest.ts](../../app/manifest.ts) — PWA manifest
- [app/favicon.ico](../../app/favicon.ico)
- [components/site-header.tsx](../../components/site-header.tsx) — top nav (auth-aware links)
- [components/mobile-nav-menu.tsx](../../components/mobile-nav-menu.tsx) — `<details>`-based mobile menu
- [components/theme-provider.tsx](../../components/theme-provider.tsx) — `next-themes` wrapper
- [components/theme-toggle.tsx](../../components/theme-toggle.tsx) — dark/light button
- [lib/ui/toast.ts](../../lib/ui/toast.ts) — single-slot sonner helpers

## Docs in this folder

| File | What it covers |
|---|---|
| [architecture.md](./architecture.md) | Layout tree, font loading, theme + toaster wiring |
| [frontend.md](./frontend.md) | Each component / page surface |
| [backend.md](./backend.md) | _N/A — UI domain has no backend logic_ |
| [api.md](./api.md) | _N/A_ |
| [rules.md](./rules.md) | One toast system, one theme provider, no parallel UI primitives |
| [patterns.md](./patterns.md) | Single-slot toasts via fixed IDs, server-component header reads cookies |
| [gotchas.md](./gotchas.md) | Theme hydration mismatch, mobile menu close-on-outside-click |

## Related domains

- [camp-auth](../camp-auth/README.md) — header reads camp + admin cookies to toggle links.
- [admin](../admin/README.md) — admin layout overrides via `(panel)` group.
- All UI surfaces — they all sit inside `app/layout.tsx`'s tree.
