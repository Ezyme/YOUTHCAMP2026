# unmasked — backend

## Pure engine — [lib/games/unmasked/engine.ts](../../lib/games/unmasked/engine.ts)

No DB, no React, no I/O. Importable from both client and server.

### Key exports

| Export | Purpose |
|---|---|
| `Tile`, `Board`, `GameState`, `RevealResult` | Types |
| `LIE_TEXTS` (constant) | 20 prewritten lie messages |
| `generateBoard(seed, gridSize, totalLies, verseFragments)` | Deterministic board from a Mulberry32 seed |
| `floodReveal(board, startIndex, revealed)` | 0-cascade BFS reveal |
| `revealTile(state, index)` → `RevealResult` | Mutating reveal |
| `toggleFlag(state, index)` | Mutating flag |
| `checkWin(state)` | Every non-lie revealed |
| `devRevealAllSafeTiles(state)` | Dev shortcut (action `dev_reveal_all_safe`) |
| `findBestSafeOpening(board, revealed, rngSeed)` | For `safe_opening` power-up |
| `applyPowerUp(state, type, rngSeed?, options?)` | All 9 power-up effects |
| `sortPersistedFragmentsForBoard(seed, gridSize, totalLies, persisted)` | Reorder DB fragments to match generated slot order |
| `trySolveVerseAssembly(indices, allFrags, solvedKeys)` | Validate a builder-row submission |
| `getDifficultyLies(gridSize, difficulty)` | Lie count from difficulty (`easy/medium/hard/expert/intense`) |
| `resolveUnmaskedLieCount(gridSize, fragCount, settings)` | Pick lie count, capped so safe + verse + 1 truth fits |
| `boardMaxAdjacentClue(board)` | Highest clue number — used to ensure clue-5+ on hard+ |
| `CHECK_PASSAGE_WRONG_PENALTY_SECONDS` (= 30) | Wrong-check timer penalty |
| `REMAINING_HEART_CLOCK_REDUCTION_SECONDS` (= 120) | Per spare heart, subtracted from final clock |

### `applyPowerUp` summary

Each power-up branches inside `applyPowerUp`. Common pattern:
1. Find an unused entry of the requested type. Return `{success: false, reason: "Power-up not available."}` if none.
2. Mark the entry `used: true` (eagerly — even if the effect fails, the charge is consumed). Exception: `safe_opening` which can fail with `success: false` but still consumes the charge.
3. Compute the effect (reveal, flag, peek, etc.).
4. If reveals happen, run `checkWin` and update status.
5. Return `{success, reason?, revealedIndex?, peekedIndex?, ...}`.

The `truth_radar` axis logic uses `getLineIndices` to pull every tile on the chosen row/col, then reveals every safe tile on the line via `revealSingleSafeTile`.

`verse_compass` reveals the **2 nearest hidden verse tiles** by Manhattan distance from the anchor — flood-revealing each (so the cascade may open more than 2 tiles total).

### `trySolveVerseAssembly`

Validation order:
1. Builder not empty.
2. Every assembled index is a real fragment.
3. All fragments share the same `verseKey`.
4. That verse isn't already restored.
5. Builder size === number of fragments for that verse (no extras / no missing).
6. Orders are 0,1,2,…,n-1 in builder order.

Returns `{ ok: true, verseKey, pointsAdded }` on success.

## `verses.ts` — Scripture pool

[Source](../../lib/games/unmasked/verses.ts).

`IDENTITY_VERSES: VerseEntry[]` — 16 passages, each with:
- `key` (stable id, e.g. `"psalm139_14"`)
- `reference` (e.g. `"Psalm 139:14"`)
- `full` (the whole verse — used for admin/tooling, not displayed mid-game)
- `fragments` (string[] — the chunks players assemble)

`pickVersesForGame(seed, count, poolKeys?)` — deterministic pick. `flattenVersesToFragments(verses)` — splits into a flat array of `{ text, order, verseKey }` placements.

The `key` field is **load-bearing** — it appears in `UnmaskedState.verseKeys`, `UnmaskedState.verseFragments[].verseKey`, and `versesRestored`. Renaming a key orphans existing saves. Don't.

## `plan-layout.ts`

[Source](../../lib/games/unmasked/plan-layout.ts).

`planUnmaskedLayout(settings, baseSeed)`:
1. Pick `verseCount` verses (default 4) from the pool.
2. Flatten to fragments.
3. Decide `gridSize` (clamped 8–24, expanded if not enough safe tiles for fragments).
4. Compute `totalLies` via `resolveUnmaskedLieCount`.
5. Generate the board.
6. **On hard/expert/intense difficulties**, hunt for a board whose `boardMaxAdjacentClue >= 5`. Tries up to 900 reseeded variants, then bumps `totalLies` and tries again. Why: those difficulty levels deserve at least one tile flashing a 5+ clue. Visual / cognitive load.
7. Map fragments to their assigned tile indices.
8. Return `{seed, gridSize, totalLies, verseKeys, verseFragments}`.

## `redeem-grants.ts`

[Source](../../lib/games/unmasked/redeem-grants.ts). Per-type charge counts.

```ts
const CHARGES_PER_REDEMPTION: Partial<Record<PowerUpType, number>> = {
  reveal: 5,         // REVEAL_CHARGES_PER_REDEMPTION
  scout: 3,
  gentle_step: 2,
  lie_pin: 2,
  verse_compass: 2,
};
chargesFor(type): number  // defaults to 1 for unlisted
```

`powerUpEntriesForRedemption(type)` returns N inventory entries (`type, used: false`).

To change a charge count, edit this file. Ripples to the redeem grant builder.

## `redemption-grant.ts`

[Source](../../lib/games/unmasked/redemption-grant.ts).

`buildUnmaskedGrantUpdateForPowerUp(codeUpper, type)` returns a Mongo update document:

```ts
{
  $addToSet: { redeemedCodes: codeUpper },
  $push: { powerUps: { $each: entries } },
  $set: { lastPlayActivityAt: new Date(), shielded?: true },
  $inc?: { maxHearts: N, hearts: N }
}
```

Auto-apply types (`extra_heart`, `shield`) get the bonus pre-applied via `$inc` / `$set`. The inventory entries themselves are marked `used: true` so the bonus isn't double-counted.

The set of auto-apply types is `AUTO_APPLY_POWER_UP_TYPES = new Set(["extra_heart", "shield"])` — exported and consumed by the redeem route to set `applied: boolean` in the response.

## `reset-board.ts`

[Source](../../lib/games/unmasked/reset-board.ts).

`resetUnmaskedBoardKeepTimer(sessionId, teamId, slug)`:
1. Read existing state (need `redeemedCodes` and `startedAt`).
2. Read `GameDefinition.settings`.
3. Plan a fresh layout with a new random seed.
4. Re-derive bonus hearts and shield by querying `PowerUpCode` for redeemed codes and re-applying their grants — but mark the inventory entries `used: true` so auto-apply types don't double-up the bonus.
5. Update the document: fresh layout, fresh inventory, hearts = 3 + bonus, status = "playing", `startedAt` preserved, `finishedAt`/`finalScore`/`scoreBreakdown`/`submittedAt` unset.

Returns the updated lean doc.

## `migrate-legacy-unmasked.ts`

[Source](../../lib/games/unmasked/migrate-legacy-unmasked.ts).

Handles four legacy patterns on read:
- `verseKey` (single) → `verseKeys: [verseKey]`
- `verseFragments[].verseKey` missing → fill with `verseKeys[0]` or `"unknown"`
- `verseAssembly` only → copy to `verseAssemblyIndices`
- `verseCompleted: true` → push the verse into `versesRestored`

Called by `/api/unmasked/state` GET and `/api/admin/unmasked/state` GET. Idempotent — running it on an already-migrated doc does nothing.

## `local-apply.ts` and `mirror.ts` (client-only)

`local-apply.ts`: clones state, runs the engine, returns the next slice. Used for optimistic UI.

`mirror.ts`: localStorage-backed snapshot of the mutable slice. Versioned (`v: 1`). Survives reloads. Doesn't include the board layout — that's re-derived from the server's authoritative seed/gridSize/verseFragments.

## API routes

See [api.md](./api.md) for full reference. The four routes:
- `/api/unmasked/state` — GET (load, with auto-create) + POST (partial update / reset)
- `/api/unmasked/action` — POST (reveal, flag, use_powerup, check_verse, dev_reveal_all_safe)
- `/api/unmasked/redeem` — POST (redeem a code)
- `/api/unmasked/codes` — GET/POST/PATCH/DELETE for `PowerUpCode` rows (admin panel)

Plus admin-only:
- `/api/admin/unmasked/state` — read-only spectator
- `/api/admin/unmasked/reset` — `action: "timer" | "board"`
- `/api/admin/unmasked/teams` — list per-team status
- `/api/admin/unmasked/power-up-grant-all` — bulk grant
