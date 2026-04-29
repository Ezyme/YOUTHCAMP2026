# shared-ui — gotchas

## 1. Hydration mismatch on theme without `suppressHydrationWarning`

`next-themes` toggles `class="dark"` on `<html>` based on user preference. The server can't predict it, so SSR renders `<html>` without the class. The first client render adds it — React warns about the mismatch.

Fix: `<html suppressHydrationWarning>` in `app/layout.tsx`. **Don't remove this attribute.**

## 2. `<ThemeToggle>` shows a placeholder briefly on load

```tsx
if (!mounted) return <span aria-hidden />;
```

For ~100ms after page load, the toggle is invisible. It pops in once `useEffect` runs. Acceptable trade-off — alternative is rendering a wrong-icon flash.

## 3. Mobile menu may not close on programmatic navigation

`<details>` doesn't auto-close when the user navigates via a link. The `onNavigate` callback handles this — make sure new links pass the callback when added.

If you forget, the menu stays visually open after navigation (since `<details>` open state persists).

## 4. The toast helpers' fixed IDs deduplicate aggressively

`showError("Network down")` + `showError("Validation failed")` shows only the second toast. The first is replaced.

This is the design — single-slot. If you need two distinct error toasts visible simultaneously, you'd need to add new IDs or use `sonner`'s default random IDs (don't — breaks the convention).

## 5. Admin link visibility can leak admin presence

`<SiteHeader>` shows the "Admin" link when `ADMIN_SECRET` is unset (anyone) OR the admin cookie matches. So in production with `ADMIN_SECRET` set, the Admin link only appears to admins — fine.

In dev with `ADMIN_SECRET` unset, the Admin link appears to everyone. That's expected — anyone can be admin in dev.

But: the conditional `!campLoggedIn && ...` hides Admin from logged-in campers, even if they're also admins. This is a UX choice (declutter the camper view), not a security boundary. An admin who is also a camper has to log out of camp to see the Admin link.

## 6. `globals.css` is loaded once at the root

If you add an import like `import "./globals.css"` to a sub-page, it's deduplicated by the bundler — no harm. Don't, but it's not catastrophic if you do.

## 7. Three Google fonts load on every page

`Bebas_Neue`, `Montserrat`, `Geist_Mono` all load via `next/font/google`. They're self-hosted and preloaded — but they still cost a few hundred KB of font assets. If you ever need to slim down, drop unused fonts.

The `font-mono` Tailwind class falls back to `Geist_Mono`; `font-heading` (custom) maps to `Bebas`. Removing one would need utility class updates.

## 8. The `<Toaster>` is mounted globally — pages don't add their own

If you create a page-level `<Toaster>` to override styling, you'll get duplicate toasts (each toaster instance shows them). Use the global one's `toastOptions` for per-toast styling.

## 9. `app/manifest.ts` doesn't include icons

The manifest type's `icons` field is omitted. Browsers fall back to `favicon.ico`. If you add icons, generate the various sizes (192×192, 512×512) and reference them in the manifest.

## 10. The home page hides "Team Login" once authed

```tsx
{!campLoggedIn ? <Link href="/login">Team Login</Link> : null}
```

If you ever rebrand the home page CTAs, preserve this pattern — campers shouldn't see "Login" button when they're already logged in.
