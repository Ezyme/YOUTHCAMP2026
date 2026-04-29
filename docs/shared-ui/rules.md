# shared-ui — rules

## MUST

- **Always use `lib/ui/toast.ts`** for toasts. Never call `toast(...)` from `sonner` directly.
- **Always use `<ThemeProvider>` from `@/components/theme-provider`** — never import `next-themes` directly in a server component.
- **Always set `suppressHydrationWarning` on `<html>`** — `next-themes` toggles a class server-side that the server can't predict, causing a benign mismatch warning that this attribute silences.
- **Always use Tailwind utility classes** for component styling. Custom CSS goes in `globals.css` and is reserved for cross-cutting `ui-*` primitives.
- **Always add new shared utility classes (`ui-*`) to `app/globals.css`,** not to a parallel CSS file.
- **Always render the site header inside the root layout** so every page gets it. Pages that need a custom header (e.g. login forms) should override layout, not the header.
- **The header is a server component.** It reads cookies via `next/headers`. Don't change it to client-side — you'd lose the cookie-based auth detection.

## MUST NOT

- **Never add a second toast system.** `sonner` is the only one. If `sonner` ever fails to meet a need, replace it — don't add `react-hot-toast` alongside.
- **Never roll a parallel theme store.** `next-themes` is canonical. The `ThemeProvider` wrapper is the single binding.
- **Never import `mongoose` or any DB code into a shared-ui component.** Pages that show DB data should fetch in their own server boundaries.
- **Never put auth logic into shared-ui.** The header *consumes* auth signals (cookies) but doesn't validate them. Validation lives in `lib/admin-auth.ts` and `lib/camp/auth.ts`.
- **Never add page-specific styling to `globals.css`.** Page-scoped CSS lives inline as Tailwind classes in the JSX.
- **Never edit `app/manifest.ts` to include user-specific data.** It's static and cached by browsers.
- **Never reach inside `next-themes`'s internals** to read or set themes. Use `useTheme()` hook from `next-themes` only via `<ThemeToggle>`.
- **Never break `<html suppressHydrationWarning>`.** Removing it floods the dev console with mismatch warnings.
