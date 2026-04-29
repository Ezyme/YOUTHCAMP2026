# unmasked — frontend

## `<UnmaskedBoard />` — [components/games/unmasked/unmasked-board.tsx](../../components/games/unmasked/unmasked-board.tsx)

Client component. Mounted by [`/play/[gameSlug]/page.tsx`](../../app/play/[gameSlug]/page.tsx) when `engineKey === "unmasked"`.

### Props

```ts
type Props = {
  sessionId: string;
  teamId: string;
  groupLabel?: string;
  gameSlug: string;
};
```

### State machine

The component holds:
- Engine slices: `revealed`, `flagged`, `hearts`, `maxHearts`, `liesHit`, `shielded`, `status`, `powerUps`.
- Verse-related: `verseAssemblyIndices`, `versesRestored`, `versesGivenUp`, `verseScore`, `verseFragments`, `verseKeys`.
- Run metadata: `startedAt`, `checkPassagePenaltySeconds`, `passagesComplete`, `submittedAt`, `finishedAt`.
- UI: `armedPowerUp` (the type currently waiting for a tap target), various toasts.

The board layout (seed/gridSize/totalLies/verseFragments) is fetched once on mount; the deterministic `generateBoard` rebuilds it locally for fast paint.

### Mount sequence

1. Read `localStorage` mirror via `readLocalMirror(sessionId, teamId)`. If present → paint mutable slices immediately.
2. Fetch `/api/unmasked/state?sessionId&teamId&slug`. Server response is canonical.
3. Reconcile: if mirror is older or differs, replace with server state.
4. Persist new mirror via `writeLocalMirror`.

### Reveal/flag flow

1. `applyRevealLocal(localState, index)` returns `{ result, next }` — optimistic.
2. UI updates immediately.
3. POST `/api/unmasked/action` with `{ action: "reveal" | "flag", index }`.
4. On success, replace state with `data.state` from response.
5. On failure, revert to pre-action state and `showError`.

`applyFlagLocal` short-circuits if the engine rejects (game over, already revealed) — no API call.

### Power-up usage

Two paths:

- **Auto-apply** (`extra_heart`, `shield`): never armed; redemption itself applies. The "Activate" button on inventory is hidden.
- **Armed** (rest): clicking "Use" sets `armedPowerUp`. The board repaints with a banner ("Scout armed — tap a hidden tile…"). Tapping a tile dispatches `action: "use_powerup"` with the relevant index/axis params. Server reconciles state.

For `truth_radar`, the player taps a tile, then a row/col modal appears. Both inputs are sent in one POST.

### Verse builder

A horizontal strip below the board. Players drag fragments from a "stack" panel into the strip. The order matters. "Check passage" POSTs `action: "check_verse"` with `assemblyIndices`.

On success: fragment chips animate to the "Restored passages" list, and `verseScore` ticks up.
On failure: penalty seconds accrue, and a toast shows the reference clue (e.g. "Psalm 139:14") as a hint without revealing the full text.

### Run timer display

Computed client-side from `startedAt + (now - startedAt) - checkPassagePenaltySeconds + ...`. The component reads `REMAINING_HEART_CLOCK_REDUCTION_SECONDS` (120s per spare heart on completion) for the final-score display.

### "New board" gate

The button is disabled when `passagesComplete === true`. Server also rejects via `403` — defense in depth.

### Local mirror lifecycle

Written after every successful reveal/flag/power-up/redeem/verse-check. Cleared when the team logs out (no — actually it's not, see [gotchas.md](./gotchas.md)).

## Power-up rail copy

[`lib/ui/powerup-copy.ts`](../../lib/ui/powerup-copy.ts) provides `POWER_UP_NAME`, `POWER_UP_SHORT`, `POWER_UP_HINT`, `POWER_UP_ARMED_BANNER` keyed by `PowerUpType`. The component imports these directly. To change copy, edit that file.

## Toasts

`showError` / `showSuccess` from [`lib/ui/toast.ts`](../../lib/ui/toast.ts). The component uses them for:
- Wrong code (`Invalid code`, `Code not for your team`)
- Wrong verse check (with reference clue in description)
- Power-up not available (e.g. arming Scout when no hidden tiles)
- Game over / win moments
