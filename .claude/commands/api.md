---
description: Add an API endpoint. Invokes adding-api-route, enforces layering, hands off to /ship.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
argument-hint: <endpoint description>
---

# /api — Add an API endpoint

You are adding an API endpoint for: $ARGUMENTS

If `$ARGUMENTS` is empty, ask: "Which endpoint? (method, path, purpose, auth — admin / camp-team / public)" and wait.

## Step 1 — Invoke the skill
Invoke `adding-api-route` and follow it exactly. That skill is the source of truth for layering: thin handler in `app/api/**/route.ts`, business logic in `lib/games/<engine>/`, `lib/scoring/`, `lib/camp/`, `lib/seed/`, or `lib/admin/`. Do **not** put business logic in the handler.

## Step 2 — Manifest check
Before saving the new file, confirm the path matches a `paths` glob in the Domain Manifest in `CLAUDE.md`. If not, invoke `registering-new-domain` to extend an existing domain or create a new one — do not save first and let the doc-sync hook fail.

## Step 3 — Auth gate
- **Admin route** (`app/api/admin/**`) — call `verifyAdminRequest()` from `@/lib/admin-auth` inside the handler. Middleware does **not** gate `/api/admin/**`.
- **Camp/team route** (`app/api/camp/**` or anywhere team identity matters) — read `CAMP_AUTH_COOKIE` / `CAMP_TEAM_COOKIE` from `@/lib/camp/auth` and reject if missing/invalid. Use `safeCampLoginNext()` if the handler redirects.
- **Public** — none, but consider rate-limiting the route handler if it mutates.

## Step 4 — Response shape
Match sibling `route.ts` files in the same folder. Default is `{ success: true, ... }` / `{ success: false, error: "..." }, { status }`. Inspect a sibling under the same `app/api/<area>/` folder before inventing a new shape.

## Step 5 — Docs in lockstep
Update the matching `docs/<domain>/` page in this turn. If the domain is large or unfamiliar, run `/doc-domain <key>` instead. The doc-sync Stop hook will block otherwise.

## Definition of done
- Route file at `app/api/<path>/route.ts` — thin handler delegating to `lib/`
- Auth gate present (admin / camp-team / public, explicitly chosen)
- Response shape matches siblings
- Logic lives in `lib/<area>/`, not the handler
- `docs/<domain>/` updated
- Tell the user: "Implementation in place — run `/ship` to verify."
