---
name: writing-game-engine
description: Use when adding a new game engine (new engineKey) or making non-trivial changes to mindgame or unmasked. Triggers on phrases like "new game", "add an engine", "extend mindgame", "new unmasked feature", "another game like X".
---

# writing-game-engine

## When to use
- Adding a brand new `engineKey` to `lib/games/<engine>/` (not `mindgame` or `unmasked`).
- Making structural changes to mindgame or unmasked: new state field, new compound key, new scoring mode, new admin control.

For routine route-handler additions to an existing engine, use `adding-api-route` instead.

## Steps
1. **Pick the engine key.** Lowercase, singular, kebab-case if multi-word (`mindgame`, `unmasked`, `relay-race`). Add it to:
   - `EngineKey` union in `lib/db/models.ts`.
   - `GameDefinitionSchema.engineKey.enum` array (same file).
   - `ENGINE_LABELS` in `lib/games/registry.ts`.
   - `playPathForEngine()` in the same file (decide whether the engine has a playable UI; non-playable engines return `null`).
2. **State schema.** If the engine persists per-team state (mindgame and unmasked do), add a Mongoose schema and model export to `lib/db/models.ts`:
   - Compound unique index over `(sessionId, teamId)` — and any client-side discriminator (mindgame uses `clientKey`).
   - **In dev, delete `mongoose.models.<Name>` before re-registering** if the schema has any enum or compound-index field. Copy the existing pattern from `UnmaskedState` and `PowerUpCode` — Next.js dev HMR caches stale schemas otherwise and validation silently rejects writes.
3. **Engine logic** lives in `lib/games/<engine>/`. Pure functions over plain state objects where possible — keeps unit-testing easy even without a test framework.
4. **Routes** at `app/api/<engine>/<verb>/route.ts`. Each handler: `dbConnect()`, validate, call the engine, persist, return `{ success, ... }`. Match the response shape of sibling engines.
5. **UI** at `components/games/<engine>/`. Client components only. No DB access, no engine logic in JSX — the engine lives in `lib/games/<engine>/`. The play page is `app/play/[gameSlug]/page.tsx`, which dispatches by `engineKey` (extend the dispatch when adding a new engine).
6. **Scoring tie-in.** If the engine produces placements, the existing `scoringMode` enum in `GameScoring` covers `placement_points`, `amazing_race_finish`, `amazing_race_first_only`, `manual_points`. If you need a fifth mode, update **all** consumers (model enum, `lib/scoring/points.ts`, the leaderboard breakdown). Adding a mode is a manifest-changing event.
7. **Seed.** If the engine should ship with a default `GameDefinition`, extend `lib/seed/camp-games.ts` so the admin "Seed" button creates it.
8. **Manifest.** New engines are new domains — invoke `registering-new-domain` and add `docs/<engine>/`.

## Conventions
- Engine state types live alongside their schema in `lib/db/models.ts`, with the public-safe shape mirrored or projected in `lib/games/<engine>/`.
- Player-facing copy belongs in a `lib/ui/<engine>-copy.ts` (mirror `lib/ui/powerup-copy.ts`), so you can vary tone without touching engine code.
- No live network from inside `lib/games/<engine>/` — engines are pure logic over Mongo + arguments. Network calls (Cloudinary etc.) are in `lib/cloudinary.ts` or the route handler.
- Time math in `Date.now()` is fine for most things; if you need timezone-aware logic, prefer `Intl.DateTimeFormat` with the camp's local zone over rolling your own.

## Verification
```bash
npm run lint
npm run typecheck
npm run dev
```
Then walk through the new engine end-to-end in the browser: admin creates a `GameDefinition`, a team logs in, plays a round, finishes, and the result lands on `/leaderboard` with the right points. Capture a quick log of what you did in the handoff. Do not commit; ask the user.
