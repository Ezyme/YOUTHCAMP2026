# Unmasked: Verse-tile celebration fades to normal tile after 2 s

**Date:** 2026-04-29
**Scope:** UI-only change to `components/games/unmasked/unmasked-board.tsx`
**Out of scope:** server, API, scoring, models, other games, engine logic

## Problem

When a verse (passage) tile is revealed today, it permanently uses the special `verse-magic-tile` styling: amber border, center sparkle (or coloured adjacent-lies number with shimmer drop-shadow), and a small corner sparkle. Across a fully-revealed board the amber styling adds visual noise that distracts from the gameplay-relevant adjacent-lies counts.

The verse fragment ALREADY moves to the verse-builder strip when the tile is revealed — that is the gameplay payoff. The on-board styling is purely decorative.

## Goal

When a verse tile is revealed during gameplay, briefly celebrate (current magical styling, ~2 seconds) then fade to look identical to a normal revealed safe tile. After the fade, only the adjacent-lies number is shown (or nothing if zero). The board reads as a clean grid of numbers and is no longer dominated by amber.

## Non-goals

- Changing how the verse FRAGMENT (text) is captured, displayed, or assembled.
- Changing power-up behavior (Verse Compass still operates on `tile.kind === "verse"` regardless of visual state).
- Changing scoring, reveal mechanics, or the local mirror format.
- Server changes.

## Design

### Approach: state-driven fade

Track the set of verse-tile indices currently in their "fresh" celebration window. Render those with today's magical styling; render all others (revealed verse tiles outside the window, including ones loaded from the local mirror or server on mount) with the same styling as a normal revealed safe tile. Tailwind `transition` utilities animate the color change between the two states.

#### Data

```ts
const [freshVerseTiles, setFreshVerseTiles] = useState<Set<number>>(() => new Set());
const verseFadeTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
```

`freshVerseTiles` is the visual flag the renderer reads.
`verseFadeTimers` tracks pending `setTimeout` ids so we can cancel them on retry / unmount.

#### Population rules

1. **Initial mount** — `freshVerseTiles` is empty. Tiles already revealed in the local mirror or server response render in matured (normal) styling. No celebration on reload.
2. **Optimistic reveal** — `applyRevealLocal` returns `{ result, next }` where `result.floodRevealed: number[]` lists every index newly revealed by this action (single tap or full flood-fill cascade). Filter that array for indices where `board.tiles[i].kind === "verse"`; for each, add to `freshVerseTiles` and schedule a 2 s timer that removes it.
3. **Server reconcile** — when the server response replaces local state, diff the new `revealed` Set against the previous one. For every index in `next.revealed - prev.revealed` whose `tile.kind === "verse"` AND not already in `freshVerseTiles`, add and schedule a timer. (This handles power-ups like Truth Radar that reveal verse tiles server-side; for those the server returns `revealedIndices` directly, but the diff approach is more general and covers any reconcile path.)
4. **Retry / new board** — clear `freshVerseTiles` and cancel all pending timers.
5. **Component unmount** — cancel all pending timers.

#### Helper

A small helper inside `UnmaskedBoard` keeps the population logic DRY:

```ts
const FRESH_VERSE_DURATION_MS = 2000;

const celebrateVerseReveals = useCallback((indices: Iterable<number>) => {
  const toAdd: number[] = [];
  for (const i of indices) {
    if (freshVerseTiles.has(i)) continue;
    toAdd.push(i);
  }
  if (toAdd.length === 0) return;
  setFreshVerseTiles((prev) => {
    const next = new Set(prev);
    for (const i of toAdd) next.add(i);
    return next;
  });
  for (const i of toAdd) {
    const timer = setTimeout(() => {
      setFreshVerseTiles((prev) => {
        if (!prev.has(i)) return prev;
        const next = new Set(prev);
        next.delete(i);
        return next;
      });
      verseFadeTimers.current.delete(i);
    }, FRESH_VERSE_DURATION_MS);
    verseFadeTimers.current.set(i, timer);
  }
}, [freshVerseTiles]);
```

(The closure over `freshVerseTiles` is intentional — it avoids re-celebrating an index that's already counting down. Re-evaluation when the state changes is safe.)

A cleanup `useEffect` on unmount cancels all timers:

```ts
useEffect(() => {
  return () => {
    for (const t of verseFadeTimers.current.values()) clearTimeout(t);
    verseFadeTimers.current.clear();
  };
}, []);
```

#### Wiring

Find the existing reveal hook in the component (the function that calls `applyRevealLocal` and updates state) and immediately after applying optimistic state, call `celebrateVerseReveals(newlyRevealedVerseIndices)`.

For the server-reconcile path, locate the function that swaps local state with the server response. Compute newly-revealed indices that are verse tiles, then call `celebrateVerseReveals(...)` with that set.

For retry / new board, find the handler that calls the API to start a fresh board (likely sets `revealed` back to empty). Immediately call:

```ts
for (const t of verseFadeTimers.current.values()) clearTimeout(t);
verseFadeTimers.current.clear();
setFreshVerseTiles(new Set());
```

### Render change

The verse-tile render branch ([unmasked-board.tsx:1771-1819](../../../components/games/unmasked/unmasked-board.tsx#L1771-L1819)) becomes a conditional on `freshVerseTiles.has(i)`:

- **Fresh** — today's exact rendering. Amber border, center sparkle/number, corner sparkle. Clickable as focal tile when a power-up is armed.
- **Matured** — rendered identically to the revealed-empty (non-verse) branch ([unmasked-board.tsx:1821+](../../../components/games/unmasked/unmasked-board.tsx#L1821)). `bg-white border-transparent` + the `numberColor`-styled adjacent-lies number when `adjacentLies > 0`. Same hover/highlight rings as the empty branch when a power-up is armed.

#### Animation

Add Tailwind utilities `transition-[background-color,border-color,color] duration-700 ease-out` to whichever className string the matured branch uses (the empty-tile className already has `border border-transparent bg-white`). When a tile transitions from fresh → matured, those properties animate over 700 ms. The center sparkle and corner sparkle elements unmount cleanly because they are children only of the fresh branch — the abruptness is acceptable; their disappearance is masked by the simultaneous color fade.

If the abrupt sparkle removal is jarring in browser, a follow-up tweak can wrap them in `transition-opacity duration-700` and toggle opacity to 0 100 ms before the className flips. Out of scope for v1.

### What does NOT change

- `tile.kind === "verse"` is the only authoritative marker — game logic and Verse Compass are unaffected.
- Hidden verse tiles render identically to other hidden tiles (no change).
- The verse fragment delivery to the builder strip is unchanged.
- The local mirror still stores `revealed` as a Set of indices; no new persisted state. (`freshVerseTiles` is intentionally session-only — reload should NOT re-celebrate.)
- Adjacent-lies count is still shown when `adjacentLies > 0` after maturation.

## Edge cases

| Case | Behavior |
|---|---|
| Reload mid-game | `freshVerseTiles` empty on mount; revealed verse tiles render matured immediately. ✓ |
| Flood-fill reveals multiple verse tiles | Each gets its own 2 s timer, fading independently. ✓ |
| Server reveals new verse tiles via power-up | Diff in reconcile path catches them, celebration kicks in. ✓ |
| Player clicks "Retry" while a celebration is running | Cleared explicitly, timers cancelled. No leak. ✓ |
| Player navigates away mid-celebration | Component unmount clears all timers. ✓ |
| Tile celebrates and then a power-up arms during the 2 s window | Existing focal-tile hover styles compose with the fresh branch (current behavior preserved). ✓ |
| Player uses Verse Compass to highlight matured verse tiles | Existing highlight ring lands on the matured (white-bg) tile — works because the `verse_compass` highlight checks tile kind, not visual class. ✓ |

## Verification

No test runner. Manual verification:

1. Reveal a single verse tile — see amber + sparkle for ~2 s, then fade to white-with-number (or blank if 0). ✓
2. Reveal a 0-adjacent-lies verse via flood-fill — see fade-out of the celebration; final state is a blank white tile. ✓
3. Reload the page mid-game — already-revealed verse tiles render as plain white tiles immediately. ✓
4. Click "Retry / New board" mid-celebration — no console errors, no leftover amber tiles, no leaked timers. ✓
5. Arm Verse Compass and tap a focal tile — matured verse tiles highlight with the violet ring as before. ✓
6. Run the full board for a long time — no memory growth from accumulated timers (verified by `verseFadeTimers.current.size` returning to 0 after celebrations finish; check via React DevTools or a temporary `console.log`). ✓

## Files touched

| File | Change |
|---|---|
| `components/games/unmasked/unmasked-board.tsx` | `freshVerseTiles` state, timer ref, `celebrateVerseReveals` helper, wiring on reveal/reconcile/retry/unmount, split of the verse-render branch into fresh-vs-matured |
| `docs/unmasked/frontend.md` | Note the 2 s celebration in the "Reveal/flag flow" section |
| `CLAUDE.md` | `lastVerified` for `unmasked` — already today's date; no change unless date has rolled over |

## Risks

- **Re-render frequency** — `freshVerseTiles` is a Set; each addition/removal triggers a re-render. With at most a handful of verse tiles per board (typically 6-12 fragments), the cost is trivial.
- **Flash of normal styling** before the celebration appears — should not happen because we add to `freshVerseTiles` synchronously in the optimistic-reveal path, before the next paint. If a future refactor moves the optimistic update behind an async boundary, this would need re-examination.
- **Server reconcile diff cost** — diffing two Sets of revealed indices is O(n). For a 12×12 board, n ≤ 144. Negligible.

## Rollback

Single-file change in `components/games/unmasked/unmasked-board.tsx`. Revert the commit. Nothing else depends on the new state.
