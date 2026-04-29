# unmasked — recipes

## Recipe: add a new power-up

Most likely recipe in this domain. Six places to update.

1. **`PowerUpType` union** in [`lib/db/models.ts`](../../lib/db/models.ts):
   ```ts
   export type PowerUpType = | "extra_heart" | ... | "<new_type>";
   ```
2. **`UNMASKED_POWER_UP_ENUM` array** in the same file. Add the new string. Both `UnmaskedState.powerUps[].type` and `PowerUpCode.powerUpType` validate against this.
3. **Charges** in [`lib/games/unmasked/redeem-grants.ts`](../../lib/games/unmasked/redeem-grants.ts) — add to `CHARGES_PER_REDEMPTION` if non-1.
4. **Auto-apply?** If the type should self-apply on redemption, add to `AUTO_APPLY` in [`lib/games/unmasked/redemption-grant.ts`](../../lib/games/unmasked/redemption-grant.ts) **and** add a case to `autoApplyUpdateForRedemption` for the Mongo update doc.
5. **Engine effect** in [`lib/games/unmasked/engine.ts`](../../lib/games/unmasked/engine.ts) — add a case to `applyPowerUp(state, type, rngSeed?, options?)`. Consider: what does it reveal/flag/peek? What inputs does it need (anchor, axis)? What's the failure reason if no valid target?
6. **UI copy** in [`lib/ui/powerup-copy.ts`](../../lib/ui/powerup-copy.ts) — add entries to `POWER_UP_NAME`, `POWER_UP_SHORT`, `POWER_UP_HINT`, `POWER_UP_ARMED_BANNER` (empty string if not armed).
7. **Action route** [`/api/unmasked/action/route.ts`](../../app/api/unmasked/action/route.ts) — wire the new options into `applyPowerUp` invocation if the type needs custom params (anchor index, axis, etc.). Look at how `truth_radar`, `lie_pin`, `verse_compass`, `gentle_step` thread their options.
8. **Test** the dev flow: redeem a code → use the power-up → verify board state updates.

The pattern is described in [the writing-game-engine skill](#) and [the updating-power-up-enum skill](#) — both reference `lib/db/models.ts` and the power-up files.

## Recipe: add a new identity verse

1. **Add to `IDENTITY_VERSES`** in [`lib/games/unmasked/verses.ts`](../../lib/games/unmasked/verses.ts):
   ```ts
   {
     key: "<stable_key>",            // e.g. "psalm23_1"
     reference: "Psalm 23:1",
     full: "The Lord is my shepherd, I lack nothing.",
     fragments: ["The Lord is", "my shepherd", "I lack nothing"],
   }
   ```
2. Choose the `key` carefully — it persists in `UnmaskedState.verseKeys` and `versesRestored`. Lowercase, snake_case, book + chapter + verse.
3. Choose `fragments` for natural reading flow. 3–6 fragments per verse is the sweet spot.
4. **Settings update (optional):** if a specific game restricts via `versePoolKeys`, decide whether to add the new key.
5. **Test:** seed a fresh `UnmaskedState` (clear an existing one, or use a different team), confirm the new verse can appear and be restored.

## Recipe: change board size or difficulty

1. Edit the `unmasked` row in [`lib/seed/camp-games.ts`](../../lib/seed/camp-games.ts):
   ```ts
   settings: {
     gridSize: 16,           // 8–24, will expand if not enough safe tiles
     difficulty: "expert",   // easy / medium / hard / expert / intense
     verseCount: 4,
     versePoolKeys: [],
   },
   ```
2. Run **Admin → Seed** (or POST `/api/seed`) to upsert the GameDefinition.
3. Existing `UnmaskedState` rows still have the old layout — they finish their current run with the old settings. New runs (after `/api/admin/reset-camp`) pick up the new settings.
4. To force-refresh during camp: admin can hit "Reset board" per team in `/admin/unmasked` to reshuffle with current settings.

## Recipe: change difficulty curve

Difficulty is computed in [`getDifficultyLies(gridSize, difficulty)`](../../lib/games/unmasked/engine.ts):
```ts
case "easy":    return Math.floor(total * 0.12);
case "medium":  return Math.floor(total * 0.16);
case "hard":    return Math.floor(total * 0.20);
case "expert":  return Math.floor(total * 0.24);
case "intense": return Math.floor(total * 0.28);
```

Edit the percentages. Or extend the switch with new keys (then update `camp-games.ts` to use them).

## Recipe: add a power-up that needs a custom UI affordance

E.g. a power-up that reveals a 3×3 area instead of a single tile.

1. Engine: add `applyPowerUp` case using a new `option` field (e.g. `areaCenterIndex`).
2. Action route: parse the option from request body and thread it through.
3. UI: in `<UnmaskedBoard>`, when the power-up is armed, the tap handler dispatches with `areaCenterIndex: tappedIndex`.
4. Copy: update `POWER_UP_ARMED_BANNER`.

The existing armed types (`scout`, `truth_radar`, `lie_pin`, `verse_compass`, `gentle_step`) are good templates.

## Recipe: change wrong-check penalty

`CHECK_PASSAGE_WRONG_PENALTY_SECONDS = 30` ([engine.ts:740](../../lib/games/unmasked/engine.ts#L740)). Edit and rebuild. Already-accumulated penalties don't change retroactively (they're stored in `checkPassagePenaltySeconds`).

## Recipe: re-tune `boardMaxAdjacentClue` hunting

Hard/expert/intense boards hunt for at least one tile with clue 5+. The hunt is up to 900 reseeded variants ([plan-layout.ts:64](../../lib/games/unmasked/plan-layout.ts#L64)). To raise/lower:

- Lower the threshold (`>= 4` instead of `>= 5`) for easier hunts.
- Raise the lie-count bump amount (currently `gridSize² × 0.035`) if the hunt frequently fails.
- Skip the hunt entirely on a difficulty by removing it from the `huntClue5` set.

## Recipe: rotate all redemption codes

`/api/admin/reset-camp` clears `PowerUpCode.redeemedBy[]` but keeps the codes themselves. To regenerate codes:

1. Go to `/admin/power-ups`.
2. Delete the existing rows (or PATCH them to new codes).
3. Print fresh code cards.

There's no "rotate all codes" bulk action today.

## Recipe: clear one team's Unmasked state

Use `/admin/unmasked` → click "Reset board" for that team. Preserves the run timer.

To wipe entirely (start fresh from 3 hearts, no codes redeemed):
- Mongo shell: `db.unmaskedstates.deleteOne({ sessionId, teamId })`.
- Then visit `/play/unmasked` as that team — auto-creates a fresh state.

There's no UI "wipe" button — only the keep-timer reset.

## Recipe: make the dev shortcut visible to players

`dev_reveal_all_safe` action returns 403 outside `NODE_ENV === "development"`. To enable in production (e.g. for facilitator testing):

- Don't. Remove the guard at your own risk; it's there to prevent player abuse.

If you absolutely must, gate it via `verifyAdminRequest()` instead and re-namespace under `/api/admin/unmasked/dev-reveal/`.
