---
name: adding-api-route
description: Use when adding a new endpoint under app/api/**, exposing a feature over HTTP, building a route handler, or creating an admin-only / camp-team API. Triggers on phrases like "add an API endpoint", "create a route", "expose this via HTTP", "/api/...", "POST/GET handler".
---

# adding-api-route

## When to use
Adding any new file under `app/api/**/route.ts` (or `[id]/route.ts`), or extending an existing handler with a new HTTP method.

## Steps
1. Decide the route path. Mirror sibling folder names. Admin endpoints go under `app/api/admin/<area>/`. Camp/team endpoints under `app/api/camp/<area>/`.
2. Identify (or create) the matching function in `lib/games/<engine>/`, `lib/scoring/`, `lib/seed/`, `lib/camp/`, or `lib/admin/`. **All non-trivial logic belongs there, not in `route.ts`.**
3. Create `app/api/<path>/route.ts` exporting `GET`/`POST`/`PATCH`/`DELETE` async functions. Use `NextRequest` / `NextResponse` from `next/server`. Heed Next.js 16 conventions — read `node_modules/next/dist/docs/` for any handler-shape change vs older Next.
4. In each handler: (a) authorize (see below), (b) `await dbConnect()` from `@/lib/db/connect`, (c) parse + validate input (Zod), (d) delegate to `lib/`, (e) return JSON.
5. Update the matching `docs/<domain>/` page (the doc-sync hook will block otherwise — see CLAUDE.md Domain Manifest for the file→domain map).

## Auth
- **Admin** (`app/api/admin/**`) — `await verifyAdminRequest()` from `@/lib/admin-auth` inside the handler. Returns `false` when the cookie is wrong; reject with 401. **Middleware does NOT gate `/api/admin/**`.** When `ADMIN_SECRET` is unset, the helper returns `true` (open) — that's local-dev convenience, not a bug.
- **Camp/team** — read `CAMP_AUTH_COOKIE` (`youthcamp_camp_auth`) and/or `CAMP_TEAM_COOKIE` (`youthcamp_team_id`) from `@/lib/camp/auth`. If the route consumes a `next` param for redirect, run it through `safeCampLoginNext()`.
- **Public** — none, but consider rate-limiting if mutating.

## Conventions
- Response shape is **always** `{ success: true, ... }` or `{ success: false, error: "..." }, { status: <code> }`. Match siblings before inventing a new shape.
- Wrap the body in `try/catch`; on error log with `console.error` (production keeps it; there is no `removeConsole` config) and return `{ success: false, error: "..." }` with status 500.
- Validate query params / bodies with `zod` schemas. Whitelist enums.
- Never import `mongoose` from a client component.
- Never reference `process.env.CLOUDINARY_API_SECRET` in any code reachable by the client — Cloudinary uploads must be server-signed only.
- Camp passwords: never return `passwordHash`. The Team schema has `select: false` on it; do not override with `.select('+passwordHash')` outside `lib/camp/`.

## Verification
```bash
npm run lint
npm run typecheck
```
Then `npm run dev` and exercise the route in the browser or with `curl`. After saving, check the Stop hook output — if it says `BLOCKED: Stale docs`, update the `docs/<domain>/` files it lists. **Do not** run `git add`/`commit` yourself; ask the user.
