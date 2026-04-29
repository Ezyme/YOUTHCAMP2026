# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Hard rules — read this first

These rules override any superpowers skill, sub-agent instruction, or default behavior. They are enforced by hooks but you are also expected to follow them on your own.

### 1. No auto-commit

**Never** run `git commit`, `git add`, `git push`, `gh pr create`, `gh pr merge`, or any other command that creates a commit, push, PR, or merge — unless the user **explicitly** authorizes the action in their **most recent** message using one of these keywords: `commit`, `push`, `merge`, `make a PR`, `create a PR`, `open a PR`, `ship it`.

This applies even when:
- You are in the middle of an `executing-plans` or `subagent-driven-development` flow that suggests committing between tasks.
- A `finishing-task-handoff` skill is active.
- You are a sub-agent dispatched by another Claude session.

When in doubt, ask: "Want me to commit this?" — and wait.

A `PreToolUse` Bash hook (`.claude/hooks/no-auto-commit.mjs`) enforces this. If you see `BLOCKED: User has set no-auto-commit`, ask the user to authorize.

### 2. Update docs when code changes

If you edit files under `app/`, `components/`, `lib/`, or top-level `middleware.ts` / `next.config.ts`, you **must** also update the matching domain documentation under `docs/<domain>/` in the same task. The `Domain Manifest` (at the bottom of this file) is the file→domain map.

A `Stop` hook (`.claude/hooks/doc-sync.mjs`) verifies this automatically. If you see `BLOCKED: Stale docs`, update the listed docs before finishing.

If you create a new file in a path that no manifest entry covers, the hook will tell you. Either add the file to an existing domain's `paths` in the manifest, or create a new domain entry.

`docs/<domain>/` folders may not exist yet on a fresh clone. Run `/doc-bootstrap` to scaffold them, or create the folder + at least one `.md` file when you register a new domain.

### 3. The manifest is the source of truth

Both Claude and the hooks read the same `Domain Manifest` JSON block (below). When adding a new domain or new path glob, edit that block — do not maintain a separate list elsewhere.

## Commands

```bash
npm run dev         # next dev
npm run build       # next build
npm run start       # production server
npm run lint        # eslint
npm run typecheck   # tsc --noEmit
```

There is **no test runner** (no jest/vitest/tsx tests yet). Verification is `lint` + `typecheck` + manual `npm run dev` against the affected page/API.

There is **no `scripts/` folder** for ops scripts. Bootstrap data is seeded through `app/api/seed/route.ts` (callable from the admin Seed button), not via standalone Node scripts. If you need a one-off Mongo migration, propose creating a `scripts/` folder + an npm `<verb>:<topic>` entry — and check with the user first.

## Architecture

Next.js 16 App Router fullstack camp game platform on MongoDB/Mongoose. **The Next.js you remember has changed** — read the AGENTS.md note and `node_modules/next/dist/docs/` before writing route handlers, layouts, or middleware. React 19, Tailwind 4 (PostCSS plugin), `next-themes` for dark mode, `sonner` for toasts, `lucide-react` for icons, `bcryptjs` for team-password hashing, `cloudinary` for media uploads, `zod` for validation. **No NextAuth, no Stripe, no TanStack Query, no SWR.**

### Strict layering

The codebase is small but the layers are firm. When adding code, respect them:

```
app/                 routing & layout only (App Router)
app/api/             route handlers — thin: parse, validate, authorize, delegate
components/          UI only, no business logic in JSX, no DB access
lib/db/              Mongoose connection + schemas (single file: lib/db/models.ts)
lib/games/           game engines (mindgame planner, unmasked minefield) + registry
lib/scoring/         placement points, comeback adjustment, totals
lib/seed/            camp game definitions, team login bootstrap
lib/camp/            team auth (cookie + bcrypt), team-game-access gating
lib/admin/           admin-only utilities (e.g. plain-game-scoring helpers)
lib/admin-auth.ts    admin cookie verification (matches middleware)
lib/cloudinary.ts    Cloudinary signed-upload helper
lib/ui/              tiny shared client utilities (toasts, copy)
middleware.ts        camp/admin gating
```

Hard rules: no DB access from components, no business logic inside `app/api/**` route handlers (delegate to `lib/`), no `any` unless unavoidable, return consistent JSON response shapes. The dependency direction is `app → lib/games | lib/scoring | lib/camp | lib/admin → lib/db`.

### Route handler conventions

Handlers in `app/api/**` are expected to:
1. Validate input at the boundary (Zod schemas inline or in a sibling helper).
2. Authorize:
   - **Admin routes** (`app/api/admin/**`) — call `verifyAdminRequest()` from `@/lib/admin-auth` inside the handler. **Middleware gates `/admin/*` pages but does NOT gate `/api/admin/*`** — you must add the per-handler check.
   - **Camp/team routes** — read `CAMP_AUTH_COOKIE` / `CAMP_TEAM_COOKIE` (see `@/lib/camp/auth`) when team identity matters.
   - **Public** — no gate, but rate-limit at the edge if the route is mutating.
3. Call `await dbConnect()` from `@/lib/db/connect` before touching any model.
4. Delegate to a function in `lib/games/<engine>/`, `lib/scoring/`, `lib/seed/`, or `lib/camp/` — do not inline game/scoring logic.
5. Return shapes consistent with siblings — match the existing route files in the same folder before inventing a new shape.

### Auth model (read before changing)

There are **two independent cookie auths**, both defined in plain code (not NextAuth):

- **Admin** — single shared secret in `ADMIN_SECRET` env var. `app/admin/login` POSTs to `app/api/admin/login`, which sets cookie `youthcamp_admin=<ADMIN_SECRET>`. `middleware.ts` checks the cookie value equals `ADMIN_SECRET` for `/admin/*` (except `/admin/login`); `lib/admin-auth.ts` does the same for API handlers. **If `ADMIN_SECRET` is unset, admin routes are open** — local dev convenience, never deploy without it.
- **Camp/team** — per-team accounts (`team1`…`team6`) with bcrypt password hashes seeded by `lib/seed/sync-team-logins.ts`. `lib/camp/auth.ts` exports `CAMP_AUTH_COOKIE` (`youthcamp_camp_auth=1`), `CAMP_TEAM_COOKIE` (`youthcamp_team_id=<id>`), and `isCampGateEnabled()` (env-driven). Use `safeCampLoginNext()` to sanitize the `next` query param before redirecting — open-redirect prevention.

The camp gate is **optional** — when disabled, `/camp` and `/play` stay open (handy for local dev). Don't hardcode the gate as always-on.

### Subsystems with their own conventions (read before editing)

These domains have non-obvious rules. Skim the matching `docs/<domain>/` before changing code in these areas:

- **Mindgame** (`lib/games/mindgame/`, `app/api/mindgame/**`, `components/games/mindgame/**`) — shared grid planner. State is keyed by `clientKey + sessionId + teamId` (unique compound index). Walls (`blocked`) and diagonal-allowed nodes (`diagonalNodes`) are stored as `{ r, c }` arrays.
- **Unmasked** (`lib/games/unmasked/`, `app/api/unmasked/**`, `components/games/unmasked/**`) — Minesweeper-style minefield + verse assembly. Power-ups, redemption codes (`PowerUpCode` model), penalty seconds, "given up" passages, and a separate `verseScore`. The `Schema.enum` list `UNMASKED_POWER_UP_ENUM` in `lib/db/models.ts` must stay in sync with the `PowerUpType` union — adding a new power-up means updating both.
- **Scoring** (`lib/scoring/`) — six placements (1st…6th) → points (default `[12,11,10,9,8,7]`), modulated by per-game `weight` (Amazing Race uses 2× weight by design). Modes: `placement_points`, `amazing_race_finish`, `amazing_race_first_only`, `manual_points`. `lib/scoring/comeback.ts` adjusts under-performing teams; do not bypass it. Leaderboard breakdown surfaces this in `components/leaderboard-breakdown.tsx`.
- **Camp auth** (`lib/camp/`) — `safeCampLoginNext()` is the open-redirect guard; never bypass it. The Team unique-login index is a *partial* unique index on `{ sessionId, loginUsername }` filtered by `loginUsername > ""` — a plain sparse unique would block bootstrapping multiple teams without usernames. `lib/db/connect.ts` calls `Team.syncIndexes()` on first connect to migrate legacy indexes.
- **Cloudinary uploads** (`lib/cloudinary.ts`, `app/api/cloudinary/upload/`) — admin-only signed uploads; never expose the API secret to the client.
- **Mongoose dev HMR** — `lib/db/models.ts` deletes `mongoose.models.UnmaskedState` and `mongoose.models.PowerUpCode` in dev so cached schemas with stale enums don't poison validation. If you change another model's enum, follow the same pattern.

## Conventions worth knowing

- **No new patterns without need.** Extend what's there; don't introduce a parallel architecture (e.g. don't add a `services/` folder when `lib/` is the convention).
- **Mongo connections** — `dbConnect()` from `@/lib/db/connect` only. It caches in a global, calls `Team.syncIndexes()` once, and is safe to call repeatedly.
- **Env access** — `process.env.<NAME>` directly is fine. There is no central env helper.
- **Console output** — there is no `removeConsole` config; `console.log` survives builds. Use sparingly; prefer `console.warn` / `console.error` for things that should be noticed.
- **`mongoose` is server-only** — never import it from a client component.
- **Theme** — `next-themes` provider in `components/theme-provider.tsx`. Toggle via `components/theme-toggle.tsx`. Do not roll a parallel theme store.
- **Toasts** — `sonner` via `lib/ui/toast.ts`. Don't add a second toast system.
- **Path alias** — `@/` maps to project root (see `tsconfig.json` `paths`).

## Domain Manifest

This is the **machine-readable map** of file globs → documentation folders. Both Claude and the doc-sync hook (`.claude/hooks/doc-sync.mjs`) read this block to determine which `docs/<domain>/` files must be updated when a given source file changes.

**Editing rules:**
- Add a new domain when you introduce a feature that doesn't fit any existing one.
- Update `paths` when you move/rename source files.
- The `lastVerified` date is auto-bumped by the doc-sync hook when docs are updated; do not hand-edit unless intentionally resetting.
- Keep one domain per logical feature; do not split a single feature across multiple domains.

The manifest format is JSON (versioned). Path globs use minimatch syntax (`**` for any depth, `{a,b}` for alternatives).

<!-- DOMAIN-MANIFEST-START -->
```json
{
  "version": 1,
  "lastModified": "2026-04-29",
  "domains": {
    "mindgame": {
      "docs": "docs/mindgame/",
      "paths": [
        "lib/games/mindgame/**",
        "components/games/mindgame/**",
        "app/api/mindgame/**"
      ],
      "lastVerified": "2026-04-29"
    },
    "unmasked": {
      "docs": "docs/unmasked/",
      "paths": [
        "lib/games/unmasked/**",
        "components/games/unmasked/**",
        "app/api/unmasked/**",
        "lib/ui/powerup-copy.ts"
      ],
      "lastVerified": "2026-04-29"
    },
    "games-shared": {
      "docs": "docs/games-shared/",
      "paths": [
        "lib/games/registry.ts",
        "app/api/games/**",
        "app/api/game-results/**",
        "app/games/**",
        "app/play/**"
      ],
      "lastVerified": "2026-04-29"
    },
    "scoring": {
      "docs": "docs/scoring/",
      "paths": [
        "lib/scoring/**",
        "lib/admin/plain-game-scoring.ts",
        "app/api/leaderboard/**",
        "app/leaderboard/**",
        "components/leaderboard-breakdown.tsx",
        "components/admin/scoring-panel.tsx",
        "app/admin/(panel)/scoring/**"
      ],
      "lastVerified": "2026-04-29"
    },
    "admin": {
      "docs": "docs/admin/",
      "paths": [
        "app/admin/**",
        "app/api/admin/**",
        "components/admin/game-form.tsx",
        "components/admin/power-ups-admin.tsx",
        "components/admin/teams-client.tsx",
        "components/admin/unmasked-teams-admin.tsx",
        "lib/admin-auth.ts"
      ],
      "lastVerified": "2026-04-29"
    },
    "camp-auth": {
      "docs": "docs/camp-auth/",
      "paths": [
        "lib/camp/**",
        "app/api/camp/login/**",
        "app/api/camp/logout/**",
        "app/api/camp/select-team/**",
        "app/login/**",
        "app/camp/**",
        "components/camp/**"
      ],
      "lastVerified": "2026-04-29"
    },
    "teams": {
      "docs": "docs/teams/",
      "paths": [
        "app/api/teams/**"
      ],
      "lastVerified": "2026-04-29"
    },
    "seed": {
      "docs": "docs/seed/",
      "paths": [
        "lib/seed/**",
        "app/api/seed/**",
        "components/admin/seed-button.tsx",
        "components/admin/reset-camp-button.tsx"
      ],
      "lastVerified": "2026-04-29"
    },
    "media-uploads": {
      "docs": "docs/media-uploads/",
      "paths": [
        "lib/cloudinary.ts",
        "app/api/cloudinary/**"
      ],
      "lastVerified": "2026-04-29"
    },
    "analytics": {
      "docs": "docs/analytics/",
      "paths": [
        "app/api/camp/analytics/**",
        "app/api/public/**"
      ],
      "lastVerified": "2026-04-29"
    },
    "shared-ui": {
      "docs": "docs/shared-ui/",
      "paths": [
        "components/site-header.tsx",
        "components/mobile-nav-menu.tsx",
        "components/theme-provider.tsx",
        "components/theme-toggle.tsx",
        "lib/ui/toast.ts",
        "app/layout.tsx",
        "app/page.tsx",
        "app/globals.css",
        "app/manifest.ts",
        "app/favicon.ico"
      ],
      "lastVerified": "2026-04-29"
    },
    "db": {
      "docs": "docs/db/",
      "paths": [
        "lib/db/**"
      ],
      "lastVerified": "2026-04-29"
    },
    "infrastructure": {
      "docs": "docs/infrastructure/",
      "paths": [
        "middleware.ts",
        "next.config.ts",
        "eslint.config.mjs",
        "postcss.config.mjs"
      ],
      "lastVerified": "2026-04-29"
    }
  }
}
```
<!-- DOMAIN-MANIFEST-END -->
