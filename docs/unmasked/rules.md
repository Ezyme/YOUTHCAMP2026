# unmasked — rules

## MUST

- **`PowerUpType` union and `UNMASKED_POWER_UP_ENUM` array must stay in sync.** They live next to each other in [lib/db/models.ts](../../lib/db/models.ts). Adding a type to one but not the other will pass `tsc` and fail at Mongoose validation runtime.
- **Verse keys are stable identifiers.** `psalm139_14` etc. are referenced from existing `UnmaskedState` documents. Renaming orphans saves.
- **Server is the canonical state.** Every reveal, flag, power-up, redeem, verse-check goes through the API. The client mirrors but doesn't own truth.
- **Auto-apply types must mark inventory entries `used: true`** when granted, so the bonus isn't double-counted (heart bonus from `extra_heart`, shield from `shield`). See `buildRedemptionEntries` in [redemption-grant.ts](../../lib/games/unmasked/redemption-grant.ts).
- **Reset-board must preserve `startedAt`.** The run timer is the camp metric — reshuffling the board is a strategy choice, not a fresh start.
- **Reset-board is forbidden when `passagesComplete === true`.** A finished run can't reshuffle.
- **`/api/unmasked/state` POST must use the partial-update idiom.** Only fields explicitly present in the body are written. Missing fields preserve their existing value. See [`buildUnmaskedPartialUpdate`](../../app/api/unmasked/state/route.ts).
- **`migrateLegacyUnmaskedState` runs on every read** (state GET + admin state GET). Don't skip it — old saves rely on it.
- **`generateBoard` is deterministic.** Same `seed + gridSize + totalLies + verseFragments` = byte-identical board. Don't introduce non-determinism.
- **Power-up grants must run through `buildUnmaskedGrantUpdateForPowerUp`.** Single source of truth for what each type does on redeem. Don't inline `$push powerUps` in routes.
- **Always uppercase + trim codes** at the boundary. Storage and lookup are uppercase. The schema enforces it.
- **`check_verse` requires `status === "won"`** (minefield clear). The route refuses with `ok: false, reason: "Clear the minefield first…"`.
- **Wrong verse checks add `CHECK_PASSAGE_WRONG_PENALTY_SECONDS` (30s)** to `checkPassagePenaltySeconds`, *unless* the reason is "already restored" (which doesn't penalize). Don't change without considering the camp UX.

## MUST NOT

- **Never let the client compute power-up effects without server reconciliation.** Optimistic UI is fine, but the server's response replaces the local state.
- **Never skip the `dev` HMR delete guards** in [models.ts:472, :482](../../lib/db/models.ts#L472). They're load-bearing for enum evolution.
- **Never persist a board layout (`seed/gridSize/totalLies/verseFragments`) that wasn't built by `planUnmaskedLayout` or `generateBoard`.** The slot-order assumption (verses go to early safe-tile slots, deterministically from seed) is encoded in the engine.
- **Never drop fields from `UnmaskedState` without a migration.** Deprecated fields (`verseKey`, `verseAssembly`, `verseCompleted`, `finalScore`) are still in the schema for old saves.
- **Never accept `powerUpType` from client input without checking it's in `UNMASKED_POWER_UP_ENUM`.** The schema validates on insert/update — but route code that constructs grant updates from arbitrary body strings could bypass via direct Mongo operators. Always cast through the enum.
- **Never mutate `LIE_TEXTS` or `IDENTITY_VERSES` arrays at runtime.** They're frozen-by-convention. Boards are deterministic from indices into these arrays.
- **Never disable the `passagesComplete` check on reset.** Allowing reshuffles after completion would let a player re-roll until a favorable layout — defeats the camp scoring.
- **Never bump `lastPlayActivityAt` from admin reads.** The field tracks "team is actively playing"; admin spectator should not nudge it.
- **Never construct a code grant that bypasses `redeemedCodes`.** If `redeemedCodes` doesn't track a code, the redeem repair path will re-grant it on next attempt — double-grant.
