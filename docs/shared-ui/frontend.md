# shared-ui — frontend

## `<SiteHeader>` — [components/site-header.tsx](../../components/site-header.tsx)

Server component. Reads cookies, decides which nav links to show, renders both desktop nav (`hidden sm:flex`) and `<MobileNavMenu>` (visible only `sm:hidden`).

Branding: "YouthCamp Games" logotype links to `/`. Theme toggle button on the right.

## `<MobileNavMenu>` — [components/mobile-nav-menu.tsx](../../components/mobile-nav-menu.tsx)

Client component. Uses `<details>` for native open/close. Auto-closes on outside click via document-level `mousedown` + `touchstart` listeners.

Each link has an `onNavigate` callback that closes the menu before the navigation fires (avoids the menu staying visually open on slow devices).

## `<ThemeProvider>` — [components/theme-provider.tsx](../../components/theme-provider.tsx)

3-line wrapper around `next-themes`'s `ThemeProvider`. Forwards all props. Exists so the layout import path is `@/components/theme-provider` instead of pulling `next-themes` directly into a server component (would warn about importing client-only code).

## `<ThemeToggle>` — [components/theme-toggle.tsx](../../components/theme-toggle.tsx)

Client. Renders a Sun (in dark mode) or Moon (in light mode) icon button. Uses `useTheme().resolvedTheme` (which collapses "system" into "light" or "dark") to decide the icon. Click toggles between explicit `light` and `dark` (no path back to "system" via the button).

Pre-mount placeholder is an empty 9×9 span — keeps layout stable while React hydrates.

## `<Toaster>` (sonner)

Mounted in `app/layout.tsx`. Position: top-center. Visible toasts: 2. Rich colors, close button on each. Use the `lib/ui/toast.ts` helpers — never call `toast(...)` from sonner directly elsewhere.

## Home page — [app/page.tsx](../../app/page.tsx)

Hero + two promo cards (Unmasked, Mindgame) + nav buttons (Browse games, Leaderboard, conditional Team Login).

The "Team Login" CTA appears only when the camp cookie is missing.

## Pages this domain owns vs reads

Owns:
- `/` (home)

Reads (renders inside SiteHeader as the title):
- All other routes — they all sit under the root layout

## Toast helpers — [lib/ui/toast.ts](../../lib/ui/toast.ts)

```ts
showError(msg, { duration?, description? })   // id: "err", default 4000ms
showSuccess(msg, opts)                          // id: "ok",  default 3000ms
showInfo(msg, opts)                             // id: "info", default 2500ms
showWarning(msg, opts)                          // id: "warn", default 4000ms
dismissToasts()                                 // clears all 4 IDs
```

Use these everywhere. Direct `toast(...)` calls bypass the single-slot guarantee and let toasts pile up.

## Manifest

`app/manifest.ts` returns the PWA manifest. Name, short_name, description, display, colors. Next.js generates `/manifest.webmanifest` automatically.
