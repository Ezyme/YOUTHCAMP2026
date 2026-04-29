# camp-auth — frontend

## Pages

### `/login` — [app/login/page.tsx](../../app/login/page.tsx)

Server component. If `youthcamp_camp_auth=1` is already set, redirects to `safeCampLoginNext(searchParams.next)` so already-authed users don't see the form again.

Otherwise renders [`<CampLoginForm />`](../../app/login/camp-login-form.tsx) inside a Suspense boundary (the form uses `useSearchParams` which streams).

### `/camp` — [app/camp/page.tsx](../../app/camp/page.tsx)

Server component. Marked `dynamic = "force-dynamic"` so it never caches. Reads:

- Latest `Session` (sort by createdAt desc)
- `youthcamp_team_id` cookie
- All teams in the session (for the team picker)
- Initial `ComebackAnalytics` for the current team

If no team cookie → redirects to `/login?next=/camp`. If no session → renders a "run seed from Admin" message.

Renders [`<CampDashboard />`](../../components/camp/camp-dashboard.tsx) and [`<CampLogoutButton />`](../../components/camp/camp-logout-button.tsx).

## Components

### `<CampLoginForm />` — [app/login/camp-login-form.tsx](../../app/login/camp-login-form.tsx)

Client component. State: `username`, `password`, `loading`. On submit:

1. POST to `/api/camp/login`.
2. On error → `showError` toast.
3. On success → `showSuccess` + `window.location.assign(next)`.

`window.location.assign` (not `router.push`) is deliberate — see [gotchas.md](./gotchas.md#1-soft-nav-can-lose-the-fresh-cookie).

`safeCampLoginNext` is called both at form mount (to compute the redirect target) and at navigation (to sanitize one more time).

### `<CampDashboard />` — [components/camp/camp-dashboard.tsx](../../components/camp/camp-dashboard.tsx)

Client component. Renders:
- Team picker `<select>` — calls `/api/camp/select-team` then refetches `/api/camp/analytics`
- Comeback analytics card (rank, gap to leader, points to pass next, etc.)
- Per-game scoring table with completed/open status
- Link to leaderboard

`router.refresh()` is called after team selection so SSR data (e.g. session label) re-renders.

### `<CampLogoutButton />` — [components/camp/camp-logout-button.tsx](../../components/camp/camp-logout-button.tsx)

Client. POSTs to `/api/camp/logout`, then `router.push('/login')` + `router.refresh()`.

### `<CampHeaderLogout />` — [components/camp/camp-header-logout.tsx](../../components/camp/camp-header-logout.tsx)

Client. Variant of the logout button used inside the site header. Two visual variants (`desktop` / `mobile`). Optional `onNavigate` callback so the mobile menu can close before navigation.

## Where the camp cookie is consumed in SSR

- [app/page.tsx](../../app/page.tsx) — toggles "Team Login" link visibility
- [app/camp/page.tsx](../../app/camp/page.tsx) — gates the dashboard
- [app/games/page.tsx](../../app/games/page.tsx) — via `loadCampTeamScoredGames`
- [app/games/[slug]/page.tsx](../../app/games/[slug]/page.tsx) — via `requireCampTeamForGameRoute`
- [app/play/[gameSlug]/page.tsx](../../app/play/[gameSlug]/page.tsx) — reads team cookie directly, redirects to `/login?next=...` if missing
- [components/site-header.tsx](../../components/site-header.tsx) — toggles "Login" vs "Sign out" link

## Theme & toast

The form uses [showError / showSuccess](../../lib/ui/toast.ts) — single-slot sonner toasts. Don't add a parallel toast system. See [shared-ui/patterns.md](../shared-ui/patterns.md).
