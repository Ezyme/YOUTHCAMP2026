# shared-ui — architecture

## Root layout tree

[`app/layout.tsx`](../../app/layout.tsx):

```
<html lang="en" suppressHydrationWarning class="<font-vars> h-full antialiased">
  <body class="flex min-h-full flex-col">
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <SiteHeader />        ← server component, reads cookies for auth-aware links
      <div class="flex flex-1 flex-col">
        {children}           ← per-route page
      </div>
      <Toaster
        position="top-center"
        visibleToasts={2}
        richColors
        closeButton
      />
    </ThemeProvider>
  </body>
</html>
```

Three Google fonts are loaded via `next/font/google`:
- `Bebas_Neue` → `--font-bebas`
- `Montserrat` → `--font-montserrat`
- `Geist_Mono` → `--font-geist-mono`

Used via Tailwind utility classes that reference the CSS variables (`font-heading`, `font-mono`, etc.) defined in [globals.css](../../app/globals.css).

## Theme provider

[`<ThemeProvider>` in components/theme-provider.tsx](../../components/theme-provider.tsx) is a thin wrapper around `next-themes`'s provider. Configured with:
- `attribute="class"` — toggles `class="dark"` on `<html>`
- `defaultTheme="system"` — follows OS preference initially
- `enableSystem` — listens for system theme changes

`<html suppressHydrationWarning>` silences the SSR/CSR mismatch warning that `next-themes` causes (the server can't know the user's preference).

## Theme toggle

[`<ThemeToggle>`](../../components/theme-toggle.tsx) is a client component. Mounts via `useEffect` to avoid hydration mismatch (returns a placeholder `<span>` until mounted). Clicking flips between light and dark — system mode is initialized but not preserved as a manual choice.

## Site header (server component)

[`<SiteHeader>`](../../components/site-header.tsx) is a **server component** that reads cookies via `next/headers`:
- `youthcamp_camp_auth=1` → camp logged in?
- `youthcamp_admin === ADMIN_SECRET` → admin authenticated?

It then renders auth-aware nav links:
- "Login" if camp not logged in
- "Sign out" (`<CampHeaderLogout>`) if camp logged in
- "Admin" if not camp-logged-in and (`ADMIN_SECRET` unset OR admin authed)

Hides the Admin link when a camper is signed in — declutters the camper UX.

## Mobile nav menu

[`<MobileNavMenu>`](../../components/mobile-nav-menu.tsx) is a client component using `<details>` for native open/close. Closes on outside click via a `mousedown`/`touchstart` listener. Renders the same baseLinks as desktop, plus context-appropriate Login/Sign out/Admin links.

## Toast system

[`lib/ui/toast.ts`](../../lib/ui/toast.ts) wraps `sonner` with single-slot semantics. Four exported helpers:
- `showError(message, opts)` — id `"err"`
- `showSuccess(message, opts)` — id `"ok"`
- `showInfo(message, opts)` — id `"info"`
- `showWarning(message, opts)` — id `"warn"`

The fixed IDs ensure firing a new error message replaces the previous one in place rather than stacking. `dismissToasts()` clears all four.

The `<Toaster>` is mounted in the root layout with `visibleToasts={2}` — even if four IDs were active, only two would show at once.

## Home page

[`app/page.tsx`](../../app/page.tsx) is a server component. Reads the camp cookie to decide whether to show the "Team Login" CTA. Renders:
- Hero with "Identity Camp 2026" + tagline
- Promo cards for `/play/unmasked` and `/play/mindgame`
- Quick links to `/games`, `/leaderboard`

## PWA manifest

[`app/manifest.ts`](../../app/manifest.ts) returns a `MetadataRoute.Manifest` with name, short_name, description, display: "standalone", colors. Next.js auto-routes this to `/manifest.webmanifest`.

## Globals CSS

[`app/globals.css`](../../app/globals.css) imports Tailwind v4's `@import "tailwindcss"` and defines CSS-custom-properties for theme colors (`--background`, `--foreground`, `--card`, etc.). Dark mode flips them via `[class~="dark"]` selectors.

The Tailwind typography plugin is loaded via `@plugin "@tailwindcss/typography";` in `globals.css`, powering the `prose` family of utilities used on the game-rules page.

It also defines a few utility classes used across the app:
- `ui-card` — card surface
- `ui-button`, `ui-button-secondary`, `ui-button-danger` — button styles
- `ui-field` — input field

Don't add component-specific CSS; use Tailwind utility classes inline.
