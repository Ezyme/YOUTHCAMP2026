# Glossary

Domain terminology used across the codebase. When in doubt, this is canon.

## A

**Active session** — The `Session` document with `active: true`. Today there's only ever one. Seed creates it; admin reset doesn't delete it.

**Amazing Race** — One of the camp's six pillars (30% of the /100 rubric). A single `GameDefinition` row with `engineKey: "config_only"`. The two playable engines (Mindgame, Unmasked) are *stations* within the Amazing Race but don't separately score on the leaderboard (`weight: 0`).

**Armed power-up** — An Unmasked power-up that requires the player to tap a target tile after activation. Opposite of *auto-apply*. Includes Prophetic Vision (`scout`), Light of Discernment (`truth_radar`), Exposing the Dark (`lie_pin`), Living Word (`verse_compass`), Steadfast Path (`gentle_step`).

**Auto-apply power-up** — An Unmasked power-up that takes effect immediately on redemption (no targeting). Includes Abundant Grace (`extra_heart`), Armor of Truth (`shield`). The corresponding inventory entry is marked `used: true` to prevent double-counting.

## B

**Backfill** — Writing default values to existing documents that were created before a new schema field was added. Not currently in code; if needed, write a one-shot script.

**Board snapshot** — In Mindgame: the `blocked` and `diagonalNodes` arrays persisted alongside positions, used to detect stale saves when the engine layout changes.

**Builder row** — In Unmasked: the horizontal strip below the board where the player drags fragments to assemble a verse before submitting via "Check passage".

## C

**Camp gate** — Optional middleware-level enforcement of camp login. Controlled by `CAMP_REQUIRE_LOGIN` env var. When ON, `/camp/*` and `/play/*` require `youthcamp_camp_auth=1` cookie.

**Charges** — Per-redemption count of inventory entries for a power-up type. E.g. `reveal: 5` means each redeemed reveal code grants 5 separate inventory entries.

**Check passage** — Action in Unmasked where the player submits the builder row's fragments to be validated against a verse. Wrong attempts add a 30s clock penalty.

**Clue 5+** — In Unmasked: a tile's adjacent-lie count of 5 or higher. On hard/expert/intense difficulties, `planUnmaskedLayout` hunts for a board with at least one tile showing a 5+ clue.

**Comeback analytics** — Per-team gap-to-leader calculation including best-possible total, points to pass next, etc. Computed by `getComebackAnalytics` in `lib/scoring/comeback.ts`.

**`config_only`** — One of three `engineKey` values. Marks a game that has no in-app play (facilitator-judged). The other two are `mindgame` and `unmasked`.

## D

**Day 0 / 1 / 2** — `GameDefinition.day` field. Day 0 = reference rows (merit, hidden from `/games`). Day 1 = pool games. Day 2 = field games + Camper's Night + Amazing Race + playable stations.

**Default scramble** — Mindgame's goal-specific initial pin arrangement (`creativePinAtVerticalSlot`). Always non-winning by construction; safety swap if it accidentally wins.

**Determinism (Unmasked)** — Same seed + gridSize + totalLies + verseFragments produces a byte-identical board. Lets the engine reconstruct the board from minimal saved state.

## F

**Fragment** — One chunk of a verse, displayed on a tile in Unmasked. Each verse splits into 3–6 fragments. Order within the verse is `0..n-1`.

## G

**Gate-on / gate-off** — Whether the camp gate is enforced. See *Camp gate*.

**Given-up passage** — In Unmasked: a verse the player has hit the max failed-check limit on. Recorded in `versesGivenUp`. The reference is shown but no `verseScore` is awarded.

**Goal** — Mindgame win condition. Three options: `sort_desc`, `sort_asc`, `odd_even`.

## H

**Hearts** — Unmasked life count. Default 3. Each unsheared lie reveal costs 1. `extra_heart` redemption raises both `hearts` and `maxHearts` by 1.

## L

**Lattice** — Mindgame's grid model. Pins live on intersections (vertices), not cells. Walls and diagonal-eligibility are properties of vertices.

**Lie** — Tile kind in Unmasked: a falsehood about identity (e.g. "You are what people think of you"). Revealing one costs a heart. 20 prewritten texts in `LIE_TEXTS`; shuffled per board, repeats appear when `totalLies > 20`.

**Lie cap** — `gridSize² - fragmentCount - 1`. Total lies are capped to leave at least one truth tile + every verse fragment placeable.

## M

**Manual points mode** — `scoringMode: "manual_points"`. Judges enter a per-team score; `placement` is derived by ranking. `manualPointsMax` caps the score.

**Masked passage** — Synonym for "verse", in Unmasked's UX. The board "masks" the passage; players "unmask" by assembling fragments.

**Merit** — One pillar of the /100 rubric (5%). Manual scores entered offline ("dog tags") and recorded in `/admin/scoring`.

**Middleware matcher** — The path patterns that trigger Edge middleware. `/camp/*`, `/play/*`, `/admin/*`. Does NOT include `/api/*`.

**Mindgame** — The grid lattice planner game. Engine in `lib/games/mindgame/engine.ts`. `weight: 0`, `isPlayable: true`.

## N

**`next` query param** — Login redirect target. Sanitized via `safeCampLoginNext` to prevent open redirects.

**New board (Unmasked)** — Self-service reshuffle. Preserves `startedAt` and redeemed codes. Disabled when `passagesComplete === true`.

## O

**Open redirect** — A redirect that takes a URL from user input without validation. The `next` param's `safeCampLoginNext` guard prevents this.

**Order** — Two distinct uses: (1) `GameDefinition.order` for intra-day sort. (2) `verseFragment.order` for fragment position within a verse (0-based).

**Orphan** — A row that references a deleted parent. `GameResult` rows reference `GameDefinition` and `Team`; deleting either creates orphan results that stay in the DB.

## P

**Partial unique index** — A MongoDB index that enforces uniqueness only when the partial filter matches. Used on `Team.{sessionId, loginUsername}` with filter `{loginUsername: {$gt: ""}}`. See [db/gotchas.md](./db/gotchas.md).

**Passage** — Synonym for "verse" in player-facing UX (Scripture references aren't shown; the in-game word is "passage").

**`passagesComplete`** — `UnmaskedState` flag set when every verse on the board is restored. Locks "New board" to prevent re-rolls.

**Penalty seconds** — In Unmasked: 30s added to the displayed clock per wrong "Check passage" attempt. Sum stored in `checkPassagePenaltySeconds`.

**Per-team code** — A `PowerUpCode` with `scope: "per_team"` locked to one team. Compare with universal codes (any team).

**Placement** — Race-style finish position 1–6. Maps to `placementPoints[idx-1]` then multiplied by weight.

**Placement points** — Array of 6 numbers per game representing the unweighted points for placements 1–6. Schema-validated to length === 6.

**Points awarded** — `GameResult.pointsAwarded`. Already multiplied by weight; stored as an integer for placement modes, 2-decimal for manual mode.

**Pool** — In Unmasked: the verse `IDENTITY_VERSES` array — the candidates a board can pick from. `versePoolKeys` setting can restrict.

**Power-up** — Unmasked inventory item. 9 types. See [unmasked/architecture.md](./unmasked/architecture.md#power-up-types-and-lifecycle).

**Power-up code** — Redemption code printed at Amazing Race stations. Players type in-game to add inventory.

## R

**Redeem repair path** — Code in `/api/unmasked/redeem` that handles half-failed prior redemptions: the team is in `PowerUpCode.redeemedBy` but the state's `redeemedCodes` doesn't include the code → apply once.

**Redeemed code** — A code marked as used by a team (in `redeemedBy` and in `redeemedCodes`).

**Reset (admin)** — Two flavors: "Reset camp" (wipes results + states) and "Reset board / timer" (per-team Unmasked reset).

**Restored verse** — A verse correctly assembled in Unmasked. Recorded in `versesRestored`.

**Rubric** — The /100 camp scoring breakdown: 5 + 25 + 30 + 10 + 10 + 20 across six pillars.

**Run timer** — Unmasked clock from `startedAt`. Survives "New board" reshuffle. Not used by Mindgame.

## S

**Safe tile** — Any non-lie tile in Unmasked (truth or verse).

**Scoring mode** — `GameDefinition.scoring.scoringMode`. Four values: `placement_points`, `amazing_race_finish`, `amazing_race_first_only`, `manual_points`.

**Seed (game)** — Two distinct uses: (1) The Mulberry32 seed for Unmasked board generation. (2) The admin "seed data" action.

**Session** — Top-level container per camp run. `Session({active:true, label:"Youth Camp 2026"})`. Today only one exists.

**Settings** — `GameDefinition.settings` is `Record<string, unknown>`. Engine-specific configuration (Unmasked grid size, difficulty, verse pool).

**Shielded** — Active state on `UnmaskedState`. Blocks the next lie reveal. Consumed on use.

**Slug** — URL-safe game identifier. Stable cross-environment. The seed upserts by slug.

**Sort order (team)** — `Team.sortOrder` numeric field. Used for stable ordering in lists and as tiebreak in manual-points placement derivation.

**Stale board** — A Mindgame save whose persisted `blocked` / `diagonalNodes` don't match the live engine layout. Discarded on load.

## T

**`team1`…`teamN`** — Default `loginUsername` values assigned by the seed.

**Truth radar** — An armed Unmasked power-up that reveals every safe tile on a chosen row or column.

**Truth tile** — Standard safe tile in Unmasked. Not a lie, not a verse fragment.

## U

**Universal code** — A `PowerUpCode` with `scope: "universal"` that any team can redeem (once).

**Unmasked** — The Identity Minefield game. Engine in `lib/games/unmasked/engine.ts`. `weight: 0`, `isPlayable: true`.

**`UNMASKED_POWER_UP_ENUM`** — The runtime array used by Mongoose to validate `PowerUpType` values. Must stay in sync with the TypeScript union.

## V

**Verse** — Bible passage in `IDENTITY_VERSES`. 16 entries. Has `key`, `reference`, `full`, `fragments`.

**Verse compass** — An armed Unmasked power-up that reveals the 2 nearest hidden verse fragments.

**Verse key** — Stable identifier for a verse (e.g. `"psalm139_14"`). Persists in saves; renaming orphans them.

**Verse pool** — Subset of `IDENTITY_VERSES` available for a given game (controlled by `versePoolKeys` setting).

**Verse score** — `UnmaskedState.verseScore`, sum of fragments restored. Not part of the camp leaderboard.

## W

**Weight** — `GameDefinition.scoring.weight` multiplier. `weight === 0` excludes the game from the leaderboard total. `weight === 1` keeps placement points as-is.

**Weighted games** — In comeback analytics: games with `weight > 0`. Mindgame and Unmasked are excluded.
