# analytics — rules

## MUST

- **Always validate ObjectIds** (`mongoose.isValidObjectId`) at the boundary of `/api/camp/analytics` before passing through to `getComebackAnalytics`.
- **`/api/public/session` must NEVER expose `passwordHash`.** The `Team` schema's `select: false` protects it; don't re-add it via explicit `.select("+passwordHash")`.
- **Always use `Team.find().lean()`** in public/session to get plain objects — the response shape strips Mongoose internals.
- **Always return a stable response shape** — the dashboard and login form depend on the exact field names. Adding fields is fine; renaming or removing requires coordinating with `<CampDashboard>` and `<CampLoginForm>`.
- **`/api/camp/analytics` must mirror the function it wraps.** If `getComebackAnalytics` adds a field to `ComebackAnalytics`, this route automatically returns it (since it just JSON-stringifies). But ensure `comeback.types.ts` is updated so client code knows the new field exists.

## MUST NOT

- **Never add a write method to `/api/public/*`.** Public routes are read-only. Mutations belong elsewhere with proper auth.
- **Never include `sortOrder`, `sessionId`, or other internal fields in the public/session response.** The route is for login UX; minimal surface area.
- **Never auth-check `/api/public/session`.** The route serves the login form — gating it would lock out unauthenticated users from logging in.
- **Never assume `/api/camp/analytics` is gated by middleware.** It's not. The route is open today. Don't store secrets in `ComebackAnalytics`.
- **Never call `/api/camp/analytics` for a team that doesn't belong to the session.** The function defends (returns null on mismatch) but the response shape becomes 404 — coordinate with the caller.
