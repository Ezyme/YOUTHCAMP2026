# analytics — gotchas

## 1. `/api/camp/analytics` is unauthenticated

The route does NOT check the camp gate cookie or admin secret. Anyone with valid `sessionId + teamId` can read another team's gap-to-leader data. In a casual-trust camp, fine — but if you ever need privacy between teams, gate this route.

## 2. `getComebackAnalytics` returns `null` for sessions with zero teams

Route returns 404 `"No data"` in that case. Caller (`<CampDashboard>`) should handle 404 gracefully. Today it just shows the toast — investigate UX if 404 happens in the wild.

## 3. `/api/public/session` returns the LATEST session, not necessarily the active one

Sort is by `createdAt: -1`. If a future workflow creates a non-active session for staging purposes, the public route would return it. Today there's only ever one session, so the distinction is moot.

If you switch to multi-session, this route should `findOne({ active: true })` instead.

## 4. `loginUsername: null` for teams without a username

Teams created via `POST /api/teams` (single-team mode) without `loginUsername` end up with `null`. The login form's selector shows their `name` but they can't log in until admin assigns a username.

`syncTeamLoginsForSession` (run during seed) auto-fills `team1`…`team6` for missing usernames. New teams added after seed need explicit `loginUsername` from the admin.

## 5. `ComebackAnalytics.games` only includes weighted games

Mindgame and Unmasked have `weight: 0` and are excluded from the per-game analytics rows. The dashboard doesn't show them in the "open games" remaining list. This is intentional — they don't affect the camp total.

## 6. `pointsToEscapeLast` is null unless you're in last

The field is computed only when `rank === totalTeams`. For 5 teams, only the team in 5th sees it. The dashboard checks `if (analytics.pointsToEscapeLast !== null)` before rendering.

If you change ranking semantics (ties), this field's null-ness might shift.

## 7. Route response is JSON-stringified Mongoose docs

`/api/public/session` does the manual stripping. `/api/camp/analytics` returns whatever `getComebackAnalytics` returns — which is already a plain object (no Mongoose docs leaked because the function uses `.lean()` and field-by-field construction).

If `getComebackAnalytics` ever stops `lean()`-ing somewhere, the route would leak Mongoose internals. Audit on changes.

## 8. The route sometimes returns `null` even with valid IDs

If `teamId` is valid format but doesn't exist in the session, `getComebackAnalytics` returns null (the team isn't found in `teamList`). The route surfaces 404 `"No data"` — but the same 404 message appears for "no teams in session" and "team not in session". Caller can't distinguish.

If you need to differentiate, add a check at the top of the function: `if (!teams.find(t => String(t._id) === teamId)) return null` returns the same null today; you'd need to throw a different error type.

## 9. The `comebackStillPossible` text is hardcoded English

The verdict strings are interpolated literals in `comeback.ts`. No i18n. If the camp ever localizes, you'd extract to a string table.
