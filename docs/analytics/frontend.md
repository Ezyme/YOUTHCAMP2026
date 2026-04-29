# analytics — frontend

No pages in this domain. Two consumers across the app:

## `/api/camp/analytics`

Called by [`<CampDashboard>` in components/camp/camp-dashboard.tsx](../../components/camp/camp-dashboard.tsx) when the user switches teams in the picker. Sends `sessionId + teamId` query params, receives `ComebackAnalytics`. Updates local state, then `router.refresh()`.

The dashboard's initial render comes from SSR (`/camp/page.tsx` calls `getComebackAnalytics` directly). The API route is only used for client-side team switching.

## `/api/public/session`

Not currently called from any client component on initial scan — most callers fetch `Session` + `Team` server-side via `dbConnect()`. The route exists for any client that needs a "list teams to pick from" without authenticating.

It's plausibly used by a future "public team picker" or external embed. If unused, consider whether to keep it. No data leaks (passwords aren't returned), so keeping it is fine.

## Where comeback data is rendered

`ComebackAnalytics` is rendered in [`<CampDashboard>`](../../components/camp/camp-dashboard.tsx):
- Rank / total teams
- Current points / leader points / gap
- Team above + below
- Per-game scoring rows (placement, points, completed?)
- Best-possible total + leader pessimistic total
- "Comeback still possible" verdict text
- Points to pass next, points to escape last

See [scoring/frontend.md](../scoring/frontend.md) for related rendering (LeaderboardBreakdown).
