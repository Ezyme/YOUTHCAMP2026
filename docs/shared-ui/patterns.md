# shared-ui — patterns

## 1. Single-slot toasts via fixed IDs

```ts
const ERR_ID = "err";
toast.error(message, { id: ERR_ID, ... });
```

Sonner uses the id to deduplicate. Firing `showError("X")` then `showError("Y")` replaces "X" with "Y" in place — no stack. Two visible at once max (`<Toaster visibleToasts={2}>`).

The IDs are hardcoded constants. Don't randomize per call — that loses the deduplication.

## 2. Server-component header reading cookies

`<SiteHeader>` is a server component that calls `await cookies()` from `next/headers`. This works because RSC can read request cookies during SSR. The auth-aware nav links are computed server-side and HTML-rendered — no client JS needed for the auth UX.

Don't convert it to a client component just to add a `useState`. If you need client interactivity, add a sub-component (like `<MobileNavMenu>`) that's client-only.

## 3. `next-themes` provider as a passthrough wrapper

```tsx
export function ThemeProvider({ children, ...props }) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
```

Why: `next-themes`'s provider is a client component. Importing it directly into `app/layout.tsx` (a server component) requires a client boundary. The wrapper file is `"use client"`, so the layout can import it normally.

This is the standard "client wrapper around a third-party client component" pattern.

## 4. Mount-then-render for theme-aware UI

```tsx
const [mounted, setMounted] = useState(false);
useEffect(() => setMounted(true), []);
if (!mounted) return <span aria-hidden />;  // placeholder
```

The theme toggle uses this to avoid SSR/CSR mismatch — the SSR can't know what theme to render, so it shows a placeholder. After mount, it reads the resolved theme and renders the right icon.

Apply this pattern to any component whose first paint depends on `next-themes`.

## 5. `<details>`-based mobile menu

`<MobileNavMenu>` uses `<details>` and `<summary>` for native open/close — no React state for the open/closed flag. Outside-click handler programmatically sets `el.open = false`.

Pros: free keyboard accessibility, free open/close animation via CSS, no controlled state to manage.
Cons: limited animation control vs a dedicated drawer library.

## 6. CSS variables for theme colors

`app/globals.css` defines `--background`, `--foreground`, `--card`, etc. as CSS custom properties. Tailwind utilities use them via `bg-background`, `text-foreground`, etc. Dark mode flips the variables.

Don't hardcode hex colors in JSX. Use the variable-backed Tailwind classes.

## 7. Top-level `flex flex-col` body for footer-less layouts

```tsx
<body class="flex min-h-full flex-col">
  <SiteHeader />
  <div class="flex flex-1 flex-col">{children}</div>
  <Toaster .../>
</body>
```

The flex layout with `flex-1` lets pages with little content (`/admin/login`) center vertically, and pages with lots of content scroll naturally. There's no footer today; the layout is forward-compatible if one is added.

## 8. Auth-conditional nav as flat conditionals

`<SiteHeader>` decides links via two booleans:

```ts
const campLoggedIn = jar.get(CAMP_AUTH_COOKIE)?.value === "1";
const showAdminLink = !campLoggedIn && (!adminSecret || adminCookie === adminSecret);
```

No state machine, no reducer. The visibility logic is small enough to keep flat. If it grows past 4–5 conditions, consider a single `getNavLinks(session, admin)` helper.
