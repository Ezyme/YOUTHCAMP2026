---
description: Extend a game engine (mindgame or unmasked) or scaffold a new engineKey. Enforces engine + state + route + UI layering, hands off to /ship.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
argument-hint: <engine and change, e.g. "unmasked: add new power-up" or "new engine: relay-race">
---

# /game — Modify or add a game engine

You are working on: $ARGUMENTS

If `$ARGUMENTS` is empty, ask: "Which engine (`mindgame`, `unmasked`, or new), and what's the change?" and wait.

## Step 1 — Route to the right path

- **Existing engine: mindgame** — code lives in `lib/games/mindgame/`, state via `MindgameState` model, API at `app/api/mindgame/state/`, UI at `components/games/mindgame/`. State key is the **compound** `(clientKey, sessionId, teamId)`; do not change this without a migration.
- **Existing engine: unmasked** — code lives in `lib/games/unmasked/`, state via `UnmaskedState` model, API under `app/api/unmasked/**`, UI at `components/games/unmasked/`. Power-ups are a closed enum (`UNMASKED_POWER_UP_ENUM` + `PowerUpType`) — both must be updated together. Redemption codes use the `PowerUpCode` model.
- **New engine** — invoke `writing-game-engine`. That skill is the source of truth for the `engineKey` registration, state schema, registry entry, and route placement.

## Step 2 — Manifest check

Before saving, confirm every new path matches a `paths` glob in the Domain Manifest in `CLAUDE.md`. Mindgame and unmasked are pre-registered. A new engine likely needs a new domain entry — invoke `registering-new-domain`.

## Step 3 — Layering

- Engine logic in `lib/games/<engine>/engine.ts` (or sibling `*.ts`).
- State persistence: schema in `lib/db/models.ts`. **In dev, delete `mongoose.models.<Name>` before re-registering** if you change the schema's enum or compound index — see the existing pattern for `UnmaskedState` and `PowerUpCode`. HMR will silently keep stale schemas otherwise.
- Route handler in `app/api/<engine>/...` — thin: parse, validate, call `dbConnect()`, delegate to engine, return `{ success, ... }`.
- UI in `components/games/<engine>/`. No DB access from components. No engine logic in JSX.

## Step 4 — Power-up enum sync (unmasked only)

If you add a power-up, update **both**:
- `PowerUpType` union in `lib/db/models.ts`.
- `UNMASKED_POWER_UP_ENUM` array in the same file (used by the Mongoose schema validator).
- Player-facing copy in `lib/ui/powerup-copy.ts`.
- Admin UI in `components/admin/power-ups-admin.tsx`.

Forgetting any of these causes the dev-HMR enum to drift from the schema and validation to silently reject saves.

## Step 5 — Scoring tie-in

If the new game records placements, ensure `app/api/game-results/route.ts` and the leaderboard pipeline (`lib/scoring/`) handle its `scoringMode`. The four supported modes are `placement_points`, `amazing_race_finish`, `amazing_race_first_only`, `manual_points` — adding a fifth mode is a manifest-changing event (touches `scoring` and the relevant engine domain).

## Step 6 — Docs in lockstep

Update `docs/<engine>/` (and `docs/scoring/` if scoring changed) in this turn. The doc-sync Stop hook will block otherwise.

## Definition of done

- Engine code in `lib/games/<engine>/`
- State schema + dev-HMR delete pattern in `lib/db/models.ts` if needed
- Route handler thin and delegating
- UI updated, no engine logic in JSX
- Power-up enum + copy + admin UI in sync (if applicable)
- `docs/<engine>/` updated
- Tell the user "Implementation in place — run `/ship` to verify."
