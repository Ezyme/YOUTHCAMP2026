# admin — frontend

## Pages

### `/admin/login` — [login/page.tsx](../../app/admin/login/page.tsx)

Server component wrapping `<AdminLoginForm />` in Suspense.

### `<AdminLoginForm />` — [login/login-form.tsx](../../app/admin/login/login-form.tsx)

Client component. Single password input. Reads `searchParams.next` (default `/admin`). POSTs to `/api/admin/login` with `{ secret }`. On success → `router.push(next)` + `router.refresh()`. Note this uses soft-nav (vs the camp form which uses `window.location.assign`) — soft-nav works for admin because middleware is satisfied immediately by the cookie set in the same response.

### `/admin` (dashboard) — [(panel)/page.tsx](../../app/admin/(panel)/page.tsx)

Server. Renders the seed button, reset-camp button, and quick-link cards.

- [`<SeedButton />`](../../components/admin/seed-button.tsx) — POSTs `/api/seed` (no body)
- [`<ResetCampButton />`](../../components/admin/reset-camp-button.tsx) — POSTs `/api/admin/reset-camp` after a confirm dialog

### `/admin/games` — [(panel)/games/page.tsx](../../app/admin/(panel)/games/page.tsx)

Server. Lists all `GameDefinition` rows sorted by `day` then `order`. Edit links to `/admin/games/[id]/edit`. "New game" link to `/admin/games/new`.

### `/admin/games/new` & `/admin/games/[id]/edit` — [(panel)/games/new/](../../app/admin/(panel)/games/new/page.tsx), [[id]/edit/](../../app/admin/(panel)/games/[id]/edit/page.tsx)

Server. Both render `<GameForm />`. Edit prefills `initial`. The edit page calls `plainGameScoring` to strip Mongoose internals before passing scoring as a prop.

### `<GameForm />` — [components/admin/game-form.tsx](../../components/admin/game-form.tsx)

Client. POST/PATCH `/api/games`. Uses `/api/cloudinary/upload` for media. Engine + scoring mode + placement points + weight + isPlayable + rules markdown.

### `/admin/teams` — [(panel)/teams/page.tsx](../../app/admin/(panel)/teams/page.tsx)

Server. Loads latest session + teams, hands them to `<TeamsClient />`.

### `<TeamsClient />` — [components/admin/teams-client.tsx](../../components/admin/teams-client.tsx)

Client. Manages teams (rename, color, login username, bulk password). Calls `/api/teams` (PATCH for bulk password) and `/api/teams/[id]` (PATCH/DELETE).

### `/admin/scoring` — [(panel)/scoring/page.tsx](../../app/admin/(panel)/scoring/page.tsx)

Server. Loads session, teams, and games (with `plainGameScoring`-cleaned scoring). Renders `<ScoringPanel />`.

### `<ScoringPanel />` — [components/admin/scoring-panel.tsx](../../components/admin/scoring-panel.tsx)

Client. Per-game placement entry (1st–6th) for `placement_points` / `amazing_race_*` modes; per-team score entry for `manual_points` mode. POSTs to `/api/game-results`.

### `/admin/unmasked` — [(panel)/unmasked/page.tsx](../../app/admin/(panel)/unmasked/page.tsx)

Server. Renders `<UnmaskedTeamsAdmin />`.

### `<UnmaskedTeamsAdmin />` — [components/admin/unmasked-teams-admin.tsx](../../components/admin/unmasked-teams-admin.tsx)

Client. Polls `/api/admin/unmasked/teams` for status (hearts, shielded, redeemed codes, etc.). Per-team buttons:
- Reset timer → `POST /api/admin/unmasked/reset { action: "timer" }`
- Reset board → `POST /api/admin/unmasked/reset { action: "board" }`
- Open team's saved state → `GET /api/admin/unmasked/state`

### `/admin/power-ups` — [(panel)/power-ups/page.tsx](../../app/admin/(panel)/power-ups/page.tsx)

Server. Renders `<PowerUpsAdmin />`.

### `<PowerUpsAdmin />` — [components/admin/power-ups-admin.tsx](../../components/admin/power-ups-admin.tsx)

Client. CRUD `PowerUpCode` rows via `/api/unmasked/codes`. Includes a "Grant to all teams" action via `/api/admin/unmasked/power-up-grant-all`.

## Layout

[`app/admin/(panel)/layout.tsx`](../../app/admin/(panel)/layout.tsx) renders a left sidebar (or top nav on mobile) with links to Dashboard, Games, Teams, Scoring, Unmasked, Power-ups. Routes outside the `(panel)` group (e.g. `/admin/login`) bypass this layout.

## Mounting & data flow

- All panel pages are `dynamic = "force-dynamic"` — admin views always reflect live DB state, no caching.
- Page-level data is fetched server-side and passed down as props. Client components only re-fetch on user actions (button click, form submit, polling).
- Toasts use the shared `lib/ui/toast.ts` helpers (`showError`, `showSuccess`).
- Theme toggle and site header come from the global layout — admin doesn't override them.
