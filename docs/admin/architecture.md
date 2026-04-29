# admin — architecture

## Single-secret model

Admin auth is a **single shared secret** stored in `process.env.ADMIN_SECRET`. There is no admin user table. Anyone who knows the secret has full admin powers.

The cookie:
- Name: `youthcamp_admin` (literal string, not exported as a constant — see [gotchas.md](./gotchas.md))
- Value: the **literal `ADMIN_SECRET` string**, not a derived token
- Attributes: `httpOnly`, `sameSite: lax`, `path: /`, `maxAge: 7 days`

## Two-tier gating

```
                 ┌─────────────────────────┐
GET /admin/*  →  │ middleware.ts cookie    │ →  redirect /admin/login
                 │ check (page-only)       │
                 └─────────────────────────┘

POST /api/admin/* → handler calls verifyAdminRequest() → 403 on miss
```

**Critically: middleware does NOT gate `/api/admin/*`.** The matcher in [middleware.ts:48-57](../../middleware.ts#L48-L57) is `["/admin", "/admin/:path*", …]` — that doesn't include `/api/admin/*` (the `/api/` prefix is a different segment).

Every `/api/admin/*` handler must call `verifyAdminRequest()` explicitly. Skipping that check leaves the route open. Today every handler does — but adding a new one without the check is a real risk. See [rules.md](./rules.md).

### Why two tiers?

- Pages need redirect-on-miss (UX) → middleware handles.
- API needs JSON-on-miss (HTTP semantics) → handlers check.

If you tried to merge them, middleware would have to detect content-type and respond differently — clunky. Per-handler check is fine for ~6 admin endpoints.

## `ADMIN_SECRET` unset = open admin

`verifyAdminRequest()` returns `true` when the env var is unset:

```ts
const secret = process.env.ADMIN_SECRET?.trim();
if (!secret) return true;
```

Same for middleware ([middleware.ts:35-38](../../middleware.ts#L35-L38)). This is **intentional dev convenience** — you don't have to set the secret to poke at the admin panel locally. **Never deploy without `ADMIN_SECRET` set.** See [gotchas.md](./gotchas.md).

## Page route groups

Admin pages use Next.js's parenthesized route group syntax: `app/admin/(panel)/...`. The `(panel)` segment doesn't appear in URLs but lets us put a layout (sidebar nav) on every panel page without applying it to `/admin/login`.

Layout file structure:

```
app/admin/layout.tsx               // bare passthrough — required so /admin/login can be its own thing
app/admin/login/page.tsx           // no sidebar
app/admin/(panel)/layout.tsx       // sidebar with admin nav links
app/admin/(panel)/page.tsx         // /admin (dashboard)
app/admin/(panel)/games/page.tsx   // /admin/games
…
```

## What admin actually does

| Page | DB action |
|---|---|
| `/admin` (dashboard) | Calls public `/api/seed` and `/api/admin/reset-camp` |
| `/admin/games` | Reads `GameDefinition`. Edits go through `/api/games[/...]` (public-namespaced!) |
| `/admin/games/new`, `/admin/games/[id]/edit` | `<GameForm>` POSTs/PATCHes `/api/games` |
| `/admin/teams` | `<TeamsClient>` PATCHes `/api/teams` (public-namespaced!) |
| `/admin/scoring` | `<ScoringPanel>` POSTs `/api/game-results` (public-namespaced!) |
| `/admin/power-ups` | `<PowerUpsAdmin>` calls `/api/unmasked/codes` (public-namespaced!) |
| `/admin/unmasked` | `<UnmaskedTeamsAdmin>` calls `/api/admin/unmasked/...` (admin-namespaced) |

Notice the inconsistency: most write endpoints used by the admin panel are **public-namespaced**, not under `/api/admin/`. That's because they were built before the admin/non-admin split was clear, and they don't currently re-check auth. The middleware redirects `/admin/*` page renders to login, but the underlying write APIs are open. **This is a known gap.** See [rules.md](./rules.md) and [gotchas.md](./gotchas.md).

## File / folder map

```
middleware.ts                              // gates /admin/* pages
app/admin/layout.tsx                       // root passthrough
app/admin/login/page.tsx                   // login page
app/admin/login/login-form.tsx             // client form
app/admin/(panel)/layout.tsx               // sidebar
app/admin/(panel)/page.tsx                 // dashboard (seed + reset)
app/admin/(panel)/games/                   // games list + create + edit
app/admin/(panel)/teams/page.tsx           // teams CRUD
app/admin/(panel)/scoring/page.tsx         // results entry
app/admin/(panel)/unmasked/page.tsx        // spectator
app/admin/(panel)/power-ups/page.tsx       // power-up codes
app/api/admin/login/route.ts               // sets cookie
app/api/admin/reset-camp/route.ts          // wipes results, mindgame, unmasked, power-up redemptions
app/api/admin/unmasked/                    // admin-only: state read, reset, teams list, grant-all
lib/admin-auth.ts                          // verifyAdminRequest()
lib/admin/plain-game-scoring.ts            // strip Mongoose subdoc metadata for client props
components/admin/                          // game-form, scoring-panel, teams-client, etc.
```
