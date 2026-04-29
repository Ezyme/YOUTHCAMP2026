---
description: Substance review of current branch vs main. Surfaces layering, manifest, security, and docs issues. Does not apply fixes.
allowed-tools: Read, Glob, Grep, Bash
argument-hint: [path or domain key]
---

# /review — Substance review of the branch

Scope: $ARGUMENTS (empty = full diff against `main`).

This judges whether the code is *right*; `/ship` checks whether it *passes*. They are complementary, not redundant.

## Step 1 — Diff
Run `git diff main...HEAD --stat` then `git diff main...HEAD` for the changed files. If `$ARGUMENTS` is non-empty, restrict to that path or domain.

## Step 2 — Layering
Flag any `app/api/**/route.ts` containing non-trivial business logic — that belongs in `lib/games/<engine>/`, `lib/scoring/`, `lib/camp/`, `lib/seed/`, or `lib/admin/`. Flag DB access (`mongoose`, model imports) from a component file.

## Step 3 — Manifest
Every changed file must match a Domain Manifest `paths` glob. List orphans.

## Step 4 — Subsystem invariants
If the diff touches mindgame, unmasked, scoring, camp-auth, db, or media-uploads, cross-check against the matching `docs/<domain>/` invariants. Cite the exact doc. Specific traps to look for:
- Unmasked: `UNMASKED_POWER_UP_ENUM` (in `lib/db/models.ts`) and the `PowerUpType` union must stay in sync.
- Mindgame: state key is the compound `(clientKey, sessionId, teamId)` — don't treat any one alone as unique.
- Scoring: `weight` modulates points; Amazing Race uses 2× weight by design — don't normalise it away.
- Camp auth: any redirect using a `next` param must go through `safeCampLoginNext()`.
- Team model: unique login is a *partial* unique index filtered by `loginUsername > ""` — never replace with plain sparse unique.

## Step 5 — Response shapes
New `route.ts` files must match sibling response shapes in the same folder. Flag drift from `{ success, ... }` / `{ success: false, error }`.

## Step 6 — Verification scope
For every changed area, name what should be re-verified: `npm run lint`, `npm run typecheck`, and the user-facing flow in `npm run dev` (which page, which user action). Flag missing manual verification for changes to scoring, leaderboard, mindgame state, or unmasked redemption — these have no automated coverage.

## Step 7 — Security
Flag:
- Missing `verifyAdminRequest()` in `app/api/admin/**` handlers (middleware does NOT gate `/api`).
- `mongoose` imported into client (`"use client"`) code.
- Cloudinary `api_secret` referenced anywhere in client code.
- Open-redirect via raw `next` param without `safeCampLoginNext()`.
- Storing `passwordHash` in any response (Team schema has `select: false` on it — don't override).

## Step 8 — Docs
Every changed `app/`, `components/`, `lib/`, `middleware.ts`, or `next.config.ts` path must have a matching `docs/<domain>/` update in the same diff. List gaps.

## Definition of done
A bulleted list grouped by severity:
- **Blocker** — must fix before commit
- **Should** — likely a problem
- **Nit** — style / consistency

If clean, say so explicitly. **Do not** apply fixes — that is a separate turn.

## STOP
End with: "Address blockers, then run `/ship`."
