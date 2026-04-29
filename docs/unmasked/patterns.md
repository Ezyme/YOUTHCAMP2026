# unmasked — patterns

## 1. Pure engine + thin route + reconciling client

Same shape as Mindgame — but Unmasked makes the route a real referee. The route:
1. Reads the doc.
2. Calls `rebuildGameState(doc)` which runs `generateBoard(seed, gridSize, totalLies, fragments)` to reconstitute the engine state.
3. Mutates state via the engine functions (`revealTile`, `applyPowerUp`, etc.).
4. Writes the post-mutation slice back.

Why rebuild the board on every action: storing the board is heavy (400 tiles on a 20×20). Storing only the seed and recomputing is fast (Mulberry32) and keeps the source of truth small.

## 2. Auto-apply vs armed split

Two categories:

- **Auto-apply** types (`extra_heart`, `shield`): redemption itself applies the bonus. Inventory entry is marked `used: true` (so it doesn't show as "available" in UI, but stays in the array for `lastPlayActivityAt` audit).
- **Armed** types: redemption pushes `{ type, used: false }`. The player explicitly arms (UI sets `armedPowerUp`), then taps a target tile, then the route applies + marks `used: true`.

`AUTO_APPLY_POWER_UP_TYPES = new Set(["extra_heart", "shield"])` — single source of truth in [redemption-grant.ts](../../lib/games/unmasked/redemption-grant.ts).

## 3. Partial update idiom for `/api/unmasked/state` POST

```ts
const copyIfPresent = (key: string) => {
  if (Object.hasOwn(body, key)) $set[key] = body[key];
};
copyIfPresent("revealed");
// ...
```

Why `Object.hasOwn` and not `body.revealed != null`: the client sends *only the fields it changed*. A partial update that drops `revealed` from the body must NOT clear the array. `Object.hasOwn` distinguishes "key explicitly present" from "key omitted".

This was the fix for an earlier bug where verse-assembly drag/drop saves were wiping `revealed` because the route defaulted missing keys to `[]`.

## 4. Deterministic seed → board

Every aspect of board generation is deterministic from the integer seed:
- Lie placement (Fisher–Yates on tile indices)
- Verse fragment slot assignment (first N safe tiles by shuffle order)
- Lie text shuffle (different mixin via `mulberry32(seed ^ 0xa5a5a5a5)`)
- Adjacent-clue counts (derived)

This means: persisting just `seed + gridSize + totalLies + verseFragments` regenerates the entire board on demand. Boards on the client and server agree because both call `generateBoard` with the same inputs.

`sortPersistedFragmentsForBoard` reorders the persisted `verseFragments` to match the current seed's slot order — so saving/loading doesn't permute fragments incorrectly.

## 5. `redeemedBy` then `redeemedCodes` (with rollback)

In `/api/unmasked/redeem`:

```ts
await PowerUpCode.updateOne({ _id: codeDoc._id }, { $addToSet: { redeemedBy: tid } });
try {
  const update = buildUnmaskedGrantUpdateForPowerUp(code, type);
  await UnmaskedState.updateOne({ sessionId, teamId }, update);
} catch (e) {
  await PowerUpCode.updateOne({ _id: codeDoc._id }, { $pull: { redeemedBy: tid } });
  throw e;
}
```

Two writes, two collections. If the second fails, undo the first. **Plus** a "repair" code path: if the team is already in `redeemedBy` but `UnmaskedState.redeemedCodes` doesn't have it, treat it as a half-failed prior attempt and apply the grant once. This recovers from cases where the rollback itself failed.

## 6. Local mirror + version stamp

`mirror.ts` writes `{ v: 1, slice: {…} }` to localStorage. The version lets future schema changes invalidate old mirrors safely. Bump `VERSION` and old mirrors are rejected on load.

The mirror only stores **mutable slices**. The board (immutable across actions) is re-derived from server data. So the mirror can never resurrect a stale layout.

## 7. Penalty seconds, not score deductions

Wrong verse checks add penalty *seconds*, not penalty *points*. Reason: the camp UX tracks "time to clear", not "score". The displayed clock includes penalty seconds; the final clock is reduced by 120s × spare hearts. Score (`verseScore`) is the verse fragment count, not affected by penalties.

## 8. `lastPlayActivityAt` tracks "actively playing"

Bumped on play GET and play actions. NOT bumped on admin reads (`/api/admin/unmasked/state`). The field powers the admin spectator dashboard's "active" indicator.

## 9. Single-file engine with clear sections

`engine.ts` is ~800 lines. Sections (in order):
1. Types
2. PRNG + shuffle
3. `generateBoard` + neighbors
4. `revealTile`, `floodReveal`, `toggleFlag`, `checkWin`
5. `revealSingleSafeTile` (helper for power-ups)
6. `findBestSafeOpening`, `getLineIndices`, `manhattanDistance`, `pickNearestByManhattan`
7. `applyPowerUp` (the longest function — 250 lines, branches per type)
8. `sortPersistedFragmentsForBoard`
9. `trySolveVerseAssembly`
10. Difficulty / sizing helpers

Length is justified by the problem domain. Splitting into sub-files (`engine/board.ts`, `engine/power-ups.ts`) is on the table but unnecessary today.

## 10. Server-side check_verse with detailed result shape

```ts
{
  result: {
    type: "verse_check",
    ok: false,
    reason: "Order doesn't match the passage yet.",
    referenceClue: "Psalm 139:14",
    penaltySecondsAdded: 30
  },
  state: { ... }
}
```

The reference clue is shown only as a hint when the player gets the verse wrong (and that verse hasn't been restored yet). Specifically excluded for the "already restored" case so duplicates aren't penalized. UX touch.
