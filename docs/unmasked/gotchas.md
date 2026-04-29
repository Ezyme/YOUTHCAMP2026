# unmasked — gotchas

## 1. Dev HMR enum poisoning

Adding a new `PowerUpType`, restarting `npm run dev`, then redeeming a code that grants the new type can fail with `ValidationError: <type> is not a valid enum value`. Cause: Mongoose cached the schema before the new enum was added.

**Fix in code:** [models.ts:472, :482](../../lib/db/models.ts#L472) — `delete mongoose.models.UnmaskedState` and `delete mongoose.models.PowerUpCode` in development before re-registering. This forces Mongoose to bind the fresh schema (with the updated enum).

If you change another model's enum, copy the pattern.

## 2. Partial-update body that omits keys does NOT reset them

`/api/unmasked/state` POST is partial. A body like:

```json
{ "sessionId": "...", "teamId": "...", "verseAssemblyIndices": [4, 17] }
```

… updates ONLY `verseAssemblyIndices`. It does NOT clear `revealed` or `flagged`. **This is the right behavior** — but earlier in development, the route used `body.revealed ?? []` which DID wipe progress on assembly drag/drop saves. The fix was the `Object.hasOwn` idiom.

If you ever rewrite this route, preserve the partial-update semantics.

## 3. Auto-grant-all doesn't pre-apply for unborn states

`/api/admin/unmasked/power-up-grant-all` adds the team to `PowerUpCode.redeemedBy` even if they haven't started Unmasked. The flow expects the redeem repair path on first state load to apply the grant — but the repair path runs only when the player **manually redeems the code again** ([redeem route:53-68](../../app/api/unmasked/redeem/route.ts#L53-L68)).

A team that has never typed a code into the UI won't have it applied just because the admin granted it. They must type it once. The first redeem will see "already in `redeemedBy` but not in `redeemedCodes`" and apply once.

This is mildly counterintuitive. If a team never types a code, the auto-grant-all is essentially a no-op for them. Consider this when planning the camp's Amazing Race UX.

## 4. Reset-board re-applies redeemed codes — including used ones

`resetUnmaskedBoardKeepTimer` recomputes inventory by replaying redeemed codes. Auto-apply types (`extra_heart`, `shield`) re-apply their bonuses but mark inventory entries `used: true` so the bonus isn't double-counted in stat displays. **Total bonus hearts and shielded state are recomputed from the codes**, not preserved from the old state.

If you ever change `chargesFor` between camp runs, the next reset-board would re-grant a different number of charges. This is the right behavior (you want the new tuning) but worth knowing.

## 5. `/api/unmasked/state` POST `reset: true` is forbidden when `passagesComplete`

The route returns 403 with `"This run is complete — starting a new board is disabled."` Self-service "New board" can't game the score. The button in `<UnmaskedBoard>` is also disabled when `passagesComplete === true`, so the API guard is defense-in-depth.

Admin's `/api/admin/unmasked/reset` does NOT have this guard — admin can force-reset a completed run if there's a real reason.

## 6. The `redeemedBy` array can hold orphan team ids

If a team is deleted, their id still sits in `PowerUpCode.redeemedBy` arrays. The codes route ([codes route:30-41](../../app/api/unmasked/codes/route.ts#L30-L41)) opportunistically prunes orphans on read by filtering against the current team list. So the UI never shows orphans, but the DB still holds them until the next list call.

Doesn't cause bugs but does drift over time.

## 7. Action route reads doc fresh, may miss in-flight updates

`POST /api/unmasked/action` does `findOne → mutate → updateOne`. There's no atomic find-and-update. If two actions race (e.g. simultaneous reveals from two browser tabs), the second mutation overwrites the first. The compound unique index on `(sessionId, teamId)` ensures you can't have parallel docs, but in-place writes can interleave.

In practice, single-user gameplay doesn't race. If a team plays from multiple browsers simultaneously, the last write wins.

## 8. Local mirror persists across logout

`mirror.ts` writes to localStorage keyed by `unmasked:<sessionId>:<teamId>`. Logout clears cookies but does NOT call `clearLocalMirror`. The next login as a different team would see a mirror keyed by their own ids, so cross-contamination is avoided. But the previous team's mirror sits in storage indefinitely.

`clearLocalMirror` is exported but not called anywhere today. If you wire it into the logout button, do it before the navigation.

## 9. `verseFragments` order is engine-determined, not save-determined

When `/api/unmasked/state` GET reads a doc and the client repaints, fragment-tile mapping comes from `generateBoard(seed, gridSize, totalLies, fragments)`. The persisted `verseFragments[].index` array is the output of that — but the client *recomputes* via `sortPersistedFragmentsForBoard` to handle the case where the persisted fragment order has drifted from the seeded slot order.

Don't try to "freeze" `verseFragments` ordering manually. The engine owns it.

## 10. `verseCheckAttemptsByKey` is type-`Mixed`

The schema is `verseCheckAttemptsByKey: { type: Schema.Types.Mixed, default: {} }`. Mongoose doesn't track changes to nested keys on Mixed fields by default — you have to call `markModified('verseCheckAttemptsByKey')` or use `$set: { 'verseCheckAttemptsByKey.<key>': N }` for changes to persist.

Today the field is rarely written via partial-update path; the action route uses `$set: { checkPassagePenaltySeconds: ... }` instead. If you start tracking per-verse attempts more aggressively, watch out for this Mongoose quirk.

## 11. `LIE_TEXTS` is shuffled per board but indexed mod-array-length

```ts
shuffledLieTexts[lieIdx % shuffledLieTexts.length]
```

If `totalLies > LIE_TEXTS.length` (currently 20), some lies will share text. On the default 20×20 / intense board (~112 lies), this is the norm. Players see repeats. Acceptable; just know it's by design.

## 12. The dev-reveal-all action is enabled only when `NODE_ENV === "development"`

[`action route:251-255`](../../app/api/unmasked/action/route.ts#L251-L255) returns 403 outside dev. If you're testing in a deployed staging environment with `NODE_ENV === "production"`, the shortcut won't work. Set `NODE_ENV=development` for the staging server, or wire it through admin auth (preferred — see [recipes.md](./recipes.md)).
