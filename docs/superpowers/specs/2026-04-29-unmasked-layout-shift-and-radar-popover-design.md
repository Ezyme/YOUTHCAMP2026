# Unmasked: Layout-shift removal + Truth Radar floating chooser

**Date:** 2026-04-29
**Scope:** UI-only change to `components/games/unmasked/unmasked-board.tsx`
**Out of scope:** server, API, scoring, models, other games

## Problem

Two concrete UX issues in the Unmasked board:

1. **Layout shifts** — content above and below the grid pops in/out, jolting the player at predictable moments.
2. **Truth Radar Row/Column chooser is hard to find** — after the player taps a tile, the chooser appears in the *top toolbar*, far from where the player's eyes are. A toast does announce armament, but the buttons are still off-screen on phones.

Both issues affect every viewport size.

## Goals

- Eliminate the two confirmed layout shifts (armed banner; game-over panel) without altering the rest of the page rhythm.
- Move the Row/Column chooser to a small floating popover anchored to the tapped tile.
- No regressions to other power-ups, the verse builder, scoring, or the top stats row.

## Non-goals

- Adding per-tile row/column coordinate labels.
- Reworking the grid layout, `aspect-square`, or `cellRem` math.
- Touching server, API, scoring, or DB.
- Animations beyond what already exists.

## Design

### 1. Reserved slot — armed banner

The banner at [unmasked-board.tsx:1572-1581](../../../components/games/unmasked/unmasked-board.tsx#L1572-L1581) renders nothing when `activePowerUp` is null, which causes the grid to jump down ~32-36 px when a power-up is armed.

**Fix:** always render the banner *container*; only fill the inner content when `activePowerUp` is truthy. The container has a fixed minimum height matching the populated state (`min-h-[1.75rem]`).

Pseudo-shape:

```tsx
<div
  role="status"
  aria-live="polite"
  className="mx-auto mb-2 flex min-h-[1.75rem] max-w-full items-center justify-center text-center text-[11px] font-medium"
>
  {!readOnly && activePowerUp ? (
    <span className="rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-primary">
      {activePowerUp === "truth_radar" && pendingAxisTile != null
        ? "Now choose Row or Column."
        : POWER_UP_ARMED_BANNER[activePowerUp]}
    </span>
  ) : null}
</div>
```

Slot is always present → no reflow when content arrives. The visible chip retains the same look and copy as today.

### 2. Reserved slot — game-over / win panel

The panel at [unmasked-board.tsx:1767+](../../../components/games/unmasked/unmasked-board.tsx#L1767) only renders when the run ends. When `status` flips to `lost` or `passagesComplete` becomes true, a tall block gets inserted, shifting the verse builder and everything below.

**Fix:** wrap the panel in a slot that always occupies vertical space matching the panel's painted size. While `status === "playing"` and not complete, the slot renders an empty placeholder of the same `min-height`. When the run ends, the panel fills the slot. No reflow.

Concrete dimensions to start with: `min-h-[6.5rem] sm:min-h-[5.5rem]`. We can refine after seeing it in browser, since the action buttons (`Retry`) wrap on phones.

**Trade-off:** an empty ~5-6 rem block sits below the grid during play. Acceptable because the verse builder lives further down anyway and the alternative (overlay/modal) hides game-over context behind a layer. If the empty space looks ugly in browser, we can add a faint hint string later — not part of v1.

### 3. Floating Row/Column popover (Truth Radar)

#### Anchoring

- The board's grid wrapper becomes `position: relative`.
- A `tileRefs` map (`Record<number, HTMLButtonElement | null>`) is populated as the grid renders.
- A new component `<TruthRadarChooser />` reads the `pendingAxisTile`'s rect via the ref and places itself with `position: absolute`.
- It only renders when `activePowerUp === "truth_radar" && pendingAxisTile != null`.

#### Visual

Small card with two buttons side by side: **Row** | **Column**. Styling matches the existing toolbar chooser at [1457-1473](../../../components/games/unmasked/unmasked-board.tsx#L1457-L1473):

- `border-primary/30 bg-primary/10 text-primary` for the buttons
- `bg-background/95 backdrop-blur` for the card surface so it reads against any tile color
- A small triangular tail pointing to the tile (CSS `::after` with rotated border)
- Slight drop-shadow for separation from the grid

#### Edge-flip rules

Compute placement from the tile's `(row, col)` derived from its grid index:

- **Top row (`row === 0`)** → popover below the tile.
- **Otherwise** → popover above the tile (default).
- **Left edge (`col === 0`)** → popover horizontally aligned to the right side of the tile.
- **Right edge (`col === gridSize - 1`)** → aligned to the left side.
- **Otherwise** → centered horizontally on the tile.

This guarantees the popover never gets clipped by the grid's outer rounded container.

#### Dismissal

- Tapping **Row** or **Column** dispatches the existing `handleTruthRadarAxis(axis)` (no logic change). When `pendingAxisTile` resets to `null` after the server response, the popover unmounts naturally.
- Pressing **Escape** calls `resetPowerUpIntent()`.
- Tapping outside the popover and outside any tile calls `resetPowerUpIntent()`. Pointer-down listener on `document` while the popover is open, with the chooser's own clicks stopping propagation. Taps on grid tiles are NOT outside-clicks: the existing `handleTileClick` flow ([line 934](../../../components/games/unmasked/unmasked-board.tsx#L934)) already re-points `pendingAxisTile` to the new tile, so the popover smoothly relocates instead of dismissing.

#### What gets removed

- The inline Row/Column buttons at [1457-1473](../../../components/games/unmasked/unmasked-board.tsx#L1457-L1473) are deleted.
- The toolbar status string at [1438-1439](../../../components/games/unmasked/unmasked-board.tsx#L1438-L1439) (`"Truth Radar locked — now choose Row or Column."`) stays as redundant guidance for keyboard / screen-reader users.

#### Accessibility

- The chooser card has `role="dialog"` `aria-label="Truth Radar axis"`.
- Focus moves to the **Row** button on mount.
- Escape cancels.
- Buttons have visible focus rings inheriting the existing `ring-primary/40` pattern.

### 4. Files touched

| File | Change |
|---|---|
| `components/games/unmasked/unmasked-board.tsx` | Banner slot, game-over slot, new `TruthRadarChooser` (inline component or extracted), tile refs, removal of inline chooser |
| `docs/unmasked/frontend.md` | Update the "Power-up usage" section to describe the floating chooser; bump `lastVerified` in CLAUDE.md's manifest entry for `unmasked` |

No new files unless we choose to extract `TruthRadarChooser` — that decision falls out of file size during implementation. The existing component is already 2071 lines, so an extraction is justified if the chooser logic + edge-flip math grows beyond ~60 lines.

## Verification

No test suite. Verification is `npm run lint`, `npm run typecheck`, and manual `npm run dev`:

1. Arm Truth Radar → tap a top-row tile → popover appears below it. Tap **Row** → reveal animation runs.
2. Tap a corner tile (each of the four corners) → popover never clips.
3. Tap a center tile → popover above, centered.
4. Press Escape mid-choice → popover dismisses, power-up still armed for re-tap.
5. Tap somewhere outside while popover open → cancels armament.
6. Toggle other power-ups (Scout, Verse Compass, Lie Pin, Gentle Step) → grid does not shift up/down because banner slot is reserved.
7. Lose a run / win a run → panel fills the reserved slot without shifting the verse builder beneath it.
8. Reload mid-run with Truth Radar armed → popover does not render until the player taps a tile (state restored from local mirror should not auto-arm).

## Risks

- **Resize / scroll while popover open** — the absolute placement is computed once. We add a `ResizeObserver` on the grid container and a `scroll` listener to recompute. If recomputation churns frames, we throttle with `requestAnimationFrame`.
- **Slot heights guessed** — the `min-h-[6.5rem] sm:min-h-[5.5rem]` for the game-over panel is an estimate. Verify in browser; adjust if either viewport reflows.
- **Mobile Safari `100vh`** — slot heights are in `rem` so this is not a factor, but the popover's edge-flip uses the *grid's* bounding rect, which is independent of viewport height. Safe.

## Rollback

Single-file change. Revert the commit; nothing else depends on the new structure.
