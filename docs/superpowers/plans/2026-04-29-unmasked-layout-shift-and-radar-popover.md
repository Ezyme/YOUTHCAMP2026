# Unmasked: Layout-shift removal + Truth Radar floating chooser — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **CRITICAL — repo rule (CLAUDE.md):** **Never auto-commit.** Each task ends with a "stage and ask" step. Do NOT run `git commit`, `git add -A`, `git push`, or any PR/merge command unless the human user explicitly authorizes the commit in their most recent message using the keywords `commit`, `push`, `merge`, `make a PR`, `create a PR`, `open a PR`, or `ship it`. The PreToolUse hook will block you anyway — but you must follow the rule on your own.
>
> **No test runner exists** in this repo. Verification = `npm run lint`, `npm run typecheck`, and manual `npm run dev` against `/play/unmasked` (the engineer should pre-arrange a logged-in team session).

**Goal:** Eliminate two layout shifts in the Unmasked board (armed-banner above the grid; game-over panel below) and replace the top-toolbar Row/Column chooser for Truth Radar with a small floating popover anchored to the tapped tile.

**Architecture:** Single-file change to [components/games/unmasked/unmasked-board.tsx](../../../components/games/unmasked/unmasked-board.tsx). Two reserved slots become permanent in the JSX so the grid never reflows when content arrives. A new inline `TruthRadarChooser` sub-component reads the tapped tile's DOM rect via a `tileRefs` map and absolutely positions itself relative to the grid container, with edge-flip logic so it never clips. The existing top-toolbar chooser block is removed. Engine/server code is untouched.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind 4, TypeScript, lucide-react. Existing helpers used unchanged: `handleTruthRadarAxis`, `resetPowerUpIntent`, `handleTileClick`, `POWER_UP_ARMED_BANNER`.

**Spec:** [docs/superpowers/specs/2026-04-29-unmasked-layout-shift-and-radar-popover-design.md](../specs/2026-04-29-unmasked-layout-shift-and-radar-popover-design.md)

---

## File map

| File | Role |
|---|---|
| `components/games/unmasked/unmasked-board.tsx` | All UI changes: banner slot, game-over slot, tile refs, popover, removal of inline chooser |
| `docs/unmasked/frontend.md` | Documentation refresh — power-up usage section |
| `CLAUDE.md` | Bump `lastVerified` for the `unmasked` domain in the Domain Manifest |

No new files. The popover lives inline in the same component.

---

## Verification (run after each task)

- `npm run lint` — must exit 0.
- `npm run typecheck` — must exit 0.
- After Tasks 1, 2, and 7: `npm run dev` and load `/play/unmasked` (logged in as a team) to confirm the visual change.

---

## Task 1: Reserve a fixed-height slot for the armed banner

**Why:** The banner above the board ([unmasked-board.tsx:1572-1581](../../../components/games/unmasked/unmasked-board.tsx#L1572-L1581)) only renders when `activePowerUp` is set, so the grid jumps down when a power-up is armed. Wrapping it in a permanent slot kills the shift.

**Files:**
- Modify: `components/games/unmasked/unmasked-board.tsx:1571-1581`

- [ ] **Step 1: Read the existing JSX block to confirm exact contents**

Run: read lines 1568-1586 of `components/games/unmasked/unmasked-board.tsx`.

Expected: confirm the structure matches the snippet shown in Step 2 below. If it doesn't (because earlier tasks reordered lines), re-locate the block by searching for `activePowerUp === "truth_radar" && pendingAxisTile != null` and adjust the edit accordingly.

- [ ] **Step 2: Replace the conditional banner with a fixed-height slot**

In `components/games/unmasked/unmasked-board.tsx`, find:

```tsx
        <div className="order-1 min-w-0 flex-1 lg:order-2">
          {!readOnly && activePowerUp ? (
            <div
              role="status"
              className="mx-auto mb-2 max-w-full rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-center text-[11px] font-medium text-primary"
            >
              {activePowerUp === "truth_radar" && pendingAxisTile != null
                ? "Now choose Row or Column."
                : POWER_UP_ARMED_BANNER[activePowerUp]}
            </div>
          ) : null}
```

Replace with:

```tsx
        <div className="order-1 min-w-0 flex-1 lg:order-2">
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

The outer `<div>` is now always present at `min-h-[1.75rem]`. The chip inside renders only when armed.

- [ ] **Step 3: Run lint + typecheck**

Run:

```bash
npm run lint
npm run typecheck
```

Expected: both exit 0.

- [ ] **Step 4: Manual verification**

Run `npm run dev` and load `/play/unmasked`. Toggle any power-up (e.g. Scout) on and off. Watch the grid's top edge — it must NOT move when the banner appears or disappears.

- [ ] **Step 5: Stage and ask**

Run:

```bash
git add components/games/unmasked/unmasked-board.tsx
git status
```

Then say to the user: **"Task 1 done — banner slot reserved. Want me to commit?"** and wait for explicit `commit` / `push` / `ship it` authorization. Do NOT commit on your own.

---

## Task 2: Reserve a fixed-height slot for the game-over panel

**Why:** The game-over / win panel ([unmasked-board.tsx:1767+](../../../components/games/unmasked/unmasked-board.tsx#L1767)) only renders when the run ends, so the page jumps when the panel arrives. Reserving a slot below the grid prevents the shift.

**Files:**
- Modify: `components/games/unmasked/unmasked-board.tsx:1767-???` (the panel block ends after its sibling-action buttons; do not modify any code outside the panel)

- [ ] **Step 1: Locate the panel block**

In `components/games/unmasked/unmasked-board.tsx`, search for `{status === "lost" || passagesComplete ? (`. The block starts at this line. Read until the matching `) : null}` to find the end.

Expected: a `<div className="rounded-xl border p-4 text-sm ...">` block roughly 30-50 lines long, ending in `) : null}`.

- [ ] **Step 2: Wrap the panel in a reserved slot**

Wrap the existing block as follows. Replace:

```tsx
      {status === "lost" || passagesComplete ? (
        <div
          className={`rounded-xl border p-4 text-sm ${
```

…with the slot wrapper PLUS the original conditional, preserving the entire panel body unchanged:

```tsx
      <div className="min-h-[6.5rem] sm:min-h-[5.5rem]">
        {status === "lost" || passagesComplete ? (
          <div
            className={`rounded-xl border p-4 text-sm ${
```

Then find the closing `) : null}` for that block and replace with:

```tsx
        ) : null}
      </div>
```

(One extra `</div>` and matching indentation — leave the inner panel body untouched.)

- [ ] **Step 3: Run lint + typecheck**

Run:

```bash
npm run lint
npm run typecheck
```

Expected: both exit 0. If typecheck fails on JSX nesting, re-read the file around the modified block and fix the indentation/closing tags.

- [ ] **Step 4: Manual verification**

Run `npm run dev` and load `/play/unmasked`. Verify:
1. During play, an empty ~5.5rem block sits below the grid (it's invisible — just whitespace).
2. Trigger a loss (use the dev shortcut `Ctrl+Shift+L` if available, or hit lies until hearts hit 0). The panel fills the slot — the verse builder beneath does NOT jump.
3. If empty whitespace looks wrong on mobile, note it in your hand-off but do NOT change `min-h` values yet — that's a follow-up tweak.

- [ ] **Step 5: Stage and ask**

```bash
git add components/games/unmasked/unmasked-board.tsx
git status
```

Say: **"Task 2 done — game-over slot reserved. Want me to commit?"** Wait for authorization.

---

## Task 3: Add a tile-ref map for popover anchoring

**Why:** The popover needs the DOM rect of the tapped tile. We collect refs into a map keyed by tile index. This task only adds the plumbing; nothing visible changes yet.

**Files:**
- Modify: `components/games/unmasked/unmasked-board.tsx` (refs declared near other refs around line 284-294; ref attached on each tile element in the `board.tiles.map(...)` block around lines 1600-1759)

- [ ] **Step 1: Declare the tile-refs map**

Find the existing refs block (search for `const persistTimer = useRef`). After the `tipTimer` ref, add:

```tsx
  const tileRefs = useRef<Map<number, HTMLElement | null>>(new Map());
```

- [ ] **Step 2: Attach refs to every tile element**

Tiles render in four shapes (revealed-lie, revealed-verse, revealed-empty, hidden), each as either a `<button>` or `<div>` depending on `needsFocalTileFromGrid`. We want the ref on every variant so any tile can anchor the popover.

For each of the eight render branches inside the `board.tiles.map((tile, i) => { ... })` loop ([approximately lines 1600-1761](../../../components/games/unmasked/unmasked-board.tsx#L1600-L1761)), add this prop:

```tsx
ref={(el) => {
  if (el) tileRefs.current.set(i, el);
  else tileRefs.current.delete(i);
}}
```

The branches are:
1. revealed-lie — `<button>` (when `needsFocalTileFromGrid`)
2. revealed-lie — `<div>` (when not)
3. revealed-verse — `<button>`
4. revealed-verse — `<div>`
5. revealed-empty — `<button>`
6. revealed-empty — `<div>`
7. hidden — `<button>` (the final `return (<button …>` near line 1722)

Don't forget any branch — Truth Radar can be armed onto a hidden OR a revealed tile (the player may have tapped a revealed empty by accident; the existing flow allows it).

- [ ] **Step 3: Run lint + typecheck**

```bash
npm run lint
npm run typecheck
```

Expected: both exit 0. Refs on `<button>` elements need `HTMLButtonElement`; on `<div>` they need `HTMLDivElement`. Using `HTMLElement` as the map's value type covers both. If TS complains about ref signature mismatches, the cause is a missing `el` callback — re-check each branch.

- [ ] **Step 4: Stage and ask**

```bash
git add components/games/unmasked/unmasked-board.tsx
git status
```

Say: **"Task 3 done — tile refs wired up (no visual change yet). Want me to commit?"** Wait for authorization.

---

## Task 4: Make the grid container `relative` so the popover can absolutely-position over it

**Why:** Adding `position: relative` to the grid wrapper lets the popover anchor inside it without affecting any other layout.

**Files:**
- Modify: `components/games/unmasked/unmasked-board.tsx:1582-1599` (the grid wrapper)

- [ ] **Step 1: Add `relative` to the outer rounded-xl wrapper**

Find:

```tsx
          <div
            className={`w-full rounded-xl bg-emerald-50/95 p-0 ring-1 ring-emerald-900/10 dark:ring-emerald-100/25 sm:p-1.5 ${
              flagMode ? "ring-2 ring-amber-400/70" : ""
            }`}
          >
```

Change to (only adding `relative` to the className):

```tsx
          <div
            className={`relative w-full rounded-xl bg-emerald-50/95 p-0 ring-1 ring-emerald-900/10 dark:ring-emerald-100/25 sm:p-1.5 ${
              flagMode ? "ring-2 ring-amber-400/70" : ""
            }`}
          >
```

- [ ] **Step 2: Run lint + typecheck**

```bash
npm run lint
npm run typecheck
```

Expected: both exit 0.

- [ ] **Step 3: Stage and ask**

```bash
git add components/games/unmasked/unmasked-board.tsx
git status
```

Say: **"Task 4 done — grid wrapper is now relative. Want me to commit?"** Wait for authorization.

---

## Task 5: Add the `TruthRadarChooser` inline component with edge-flip placement

**Why:** This is the new floating popover. It reads the tapped tile's rect, computes a placement that flips on grid edges, and renders two buttons (Row / Column) that call `handleTruthRadarAxis`.

**Files:**
- Modify: `components/games/unmasked/unmasked-board.tsx` (add the component above `export function UnmaskedBoard`, near line 222; render it inside the grid wrapper added in Task 4)

- [ ] **Step 1: Add the inline component definition**

Find the line `export function UnmaskedBoard({` (around line 223). Immediately above it, add:

```tsx
function TruthRadarChooser({
  anchor,
  gridContainer,
  row,
  col,
  gridSize,
  onChoose,
  onCancel,
}: {
  anchor: HTMLElement | null;
  gridContainer: HTMLElement | null;
  row: number;
  col: number;
  gridSize: number;
  onChoose: (axis: "row" | "col") => void;
  onCancel: () => void;
}) {
  const [pos, setPos] = useState<{ top: number; left: number; placement: "above" | "below" } | null>(
    null
  );
  const cardRef = useRef<HTMLDivElement | null>(null);

  const recompute = useCallback(() => {
    if (!anchor || !gridContainer) {
      setPos(null);
      return;
    }
    const a = anchor.getBoundingClientRect();
    const g = gridContainer.getBoundingClientRect();
    const placement: "above" | "below" = row === 0 ? "below" : "above";
    const cardWidth = cardRef.current?.offsetWidth ?? 140;
    const cardHeight = cardRef.current?.offsetHeight ?? 36;
    const gap = 8;

    const tileLeft = a.left - g.left;
    const tileTop = a.top - g.top;
    const tileWidth = a.width;
    const tileHeight = a.height;

    let left: number;
    if (col === 0) left = tileLeft + tileWidth + gap;
    else if (col === gridSize - 1) left = tileLeft - cardWidth - gap;
    else left = tileLeft + tileWidth / 2 - cardWidth / 2;

    const top =
      placement === "above" ? tileTop - cardHeight - gap : tileTop + tileHeight + gap;

    setPos({ top, left, placement });
  }, [anchor, gridContainer, row, col, gridSize]);

  useEffect(() => {
    recompute();
  }, [recompute]);

  useEffect(() => {
    if (!anchor || !gridContainer) return;
    const onResize = () => recompute();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    const ro = new ResizeObserver(onResize);
    ro.observe(gridContainer);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
      ro.disconnect();
    };
  }, [anchor, gridContainer, recompute]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node | null;
      if (cardRef.current && target && cardRef.current.contains(target)) return;
      // tile clicks (re-pointing the chooser) are handled by the existing
      // handleTileClick — those still bubble through; we only treat clicks
      // outside the grid as cancellation.
      if (gridContainer && target && gridContainer.contains(target)) return;
      onCancel();
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [gridContainer, onCancel]);

  if (!pos) return null;

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-label="Truth Radar axis"
      className="absolute z-30 flex items-center gap-1 rounded-md border border-primary/40 bg-background/95 px-1.5 py-1 shadow-md backdrop-blur"
      style={{ top: pos.top, left: pos.left }}
    >
      <button
        type="button"
        autoFocus
        onClick={() => onChoose("row")}
        className="rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/15 focus:outline-none focus:ring-2 focus:ring-primary/40"
      >
        Row
      </button>
      <button
        type="button"
        onClick={() => onChoose("col")}
        className="rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/15 focus:outline-none focus:ring-2 focus:ring-primary/40"
      >
        Column
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Add a ref for the grid container**

Inside `UnmaskedBoard`, near the other refs (right after `tileRefs` from Task 3), add:

```tsx
  const gridContainerRef = useRef<HTMLDivElement | null>(null);
```

- [ ] **Step 3: Attach the grid-container ref to the wrapper from Task 4**

In the grid wrapper modified in Task 4, add `ref={gridContainerRef}`:

```tsx
          <div
            ref={gridContainerRef}
            className={`relative w-full rounded-xl bg-emerald-50/95 p-0 ring-1 ring-emerald-900/10 dark:ring-emerald-100/25 sm:p-1.5 ${
              flagMode ? "ring-2 ring-amber-400/70" : ""
            }`}
          >
```

- [ ] **Step 4: Render the chooser inside the grid wrapper, after the tile-mapping block**

Find the closing `</div>` that ends the `gridTemplateColumns: ...` grid (the one at the end of `{board.tiles.map((tile, i) => { ... })`). Right after it (still inside the relative wrapper from Task 4), add:

```tsx
          {!readOnly &&
          activePowerUp === "truth_radar" &&
          pendingAxisTile != null &&
          board ? (
            <TruthRadarChooser
              anchor={tileRefs.current.get(pendingAxisTile) ?? null}
              gridContainer={gridContainerRef.current}
              row={Math.floor(pendingAxisTile / board.gridSize)}
              col={pendingAxisTile % board.gridSize}
              gridSize={board.gridSize}
              onChoose={(axis) => void handleTruthRadarAxis(axis)}
              onCancel={resetPowerUpIntent}
            />
          ) : null}
```

The chooser unmounts naturally when `pendingAxisTile` becomes `null` (which happens at the end of `handleTruthRadarAxis`).

- [ ] **Step 5: Run lint + typecheck**

```bash
npm run lint
npm run typecheck
```

Expected: both exit 0.

- [ ] **Step 6: Manual verification**

Run `npm run dev` and load `/play/unmasked` with Truth Radar in inventory:

1. Activate Truth Radar → tap a center tile → popover appears above the tile, centered. Click **Row** → reveal animation fires; popover closes.
2. Re-arm → tap a top-row tile → popover appears below.
3. Tap each of the four corner tiles → popover never clips outside the grid wrapper.
4. Re-arm → tap a tile → press Escape → popover closes; armament cancels.
5. Re-arm → tap a tile → click somewhere outside the grid (e.g. the timer area) → popover closes; armament cancels.
6. Re-arm → tap tile A → tap tile B (without choosing) → popover relocates to tile B (existing `handleTileClick` behavior); does NOT cancel.

If any of these fail, root-cause the placement math in `recompute` before continuing. Common causes: missing `position: relative` on the grid wrapper (Task 4), or a tile branch in Task 3 that didn't get the ref.

- [ ] **Step 7: Stage and ask**

```bash
git add components/games/unmasked/unmasked-board.tsx
git status
```

Say: **"Task 5 done — floating chooser works. Want me to commit?"** Wait for authorization.

---

## Task 6: Remove the now-redundant inline Row/Column chooser and trim toolbar copy

**Why:** With the floating popover live, the top-toolbar Row/Column buttons at [lines 1457-1473](../../../components/games/unmasked/unmasked-board.tsx#L1457-L1473) are duplicate UI. The status-text branch at lines 1438-1439 stays (it gives screen-reader users a readout) but the redundant buttons are removed.

**Files:**
- Modify: `components/games/unmasked/unmasked-board.tsx:1457-1473`

- [ ] **Step 1: Locate the chooser block**

Find this exact block:

```tsx
          {activePowerUp === "truth_radar" && pendingAxisTile != null ? (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => void handleTruthRadarAxis("row")}
                className="rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/15"
              >
                Row
              </button>
              <button
                type="button"
                onClick={() => void handleTruthRadarAxis("col")}
                className="rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/15"
              >
                Column
              </button>
            </div>
          ) : null}
```

- [ ] **Step 2: Delete it**

Replace the whole block (including the surrounding `{` and `) : null}`) with nothing. Leave a single blank line in its place if it improves readability of the surrounding code.

- [ ] **Step 3: Run lint + typecheck**

```bash
npm run lint
npm run typecheck
```

Expected: both exit 0.

- [ ] **Step 4: Manual verification**

Run `npm run dev`, arm Truth Radar, tap a tile. Confirm:
1. The toolbar no longer shows Row / Column buttons.
2. The floating popover (from Task 5) is the only chooser visible.
3. The toolbar status text still reads "Truth Radar locked — now choose Row or Column."

- [ ] **Step 5: Stage and ask**

```bash
git add components/games/unmasked/unmasked-board.tsx
git status
```

Say: **"Task 6 done — duplicate toolbar chooser removed. Want me to commit?"** Wait for authorization.

---

## Task 7: Update unmasked frontend docs and bump manifest

**Why:** Code in `components/games/unmasked/**` changed, so per CLAUDE.md hard rule #2 we must update [docs/unmasked/frontend.md](../../../docs/unmasked/frontend.md) in the same task series. The doc-sync Stop hook also flags this.

**Files:**
- Modify: `docs/unmasked/frontend.md` (the "Power-up usage" section)
- Modify: `CLAUDE.md` (the `unmasked` entry in the Domain Manifest — bump `lastVerified` to today's date)

- [ ] **Step 1: Read the current "Power-up usage" section**

Read `docs/unmasked/frontend.md`, locate the heading `### Power-up usage`. The current paragraph mentions "For `truth_radar`, the player taps a tile, then a row/col modal appears."

- [ ] **Step 2: Replace the truth_radar paragraph**

Replace:

```
For `truth_radar`, the player taps a tile, then a row/col modal appears. Both inputs are sent in one POST.
```

With:

```
For `truth_radar`, the player taps a tile, then a small floating chooser ("Row" / "Column") pops up anchored next to that tile (`TruthRadarChooser`, defined inline above `UnmaskedBoard`). Edge-flip rules keep it inside the grid wrapper: it appears below for top-row tiles, above otherwise; horizontally aligned to the right of left-edge tiles, to the left of right-edge tiles, centered otherwise. Picking an axis dispatches `handleTruthRadarAxis(axis)` and both inputs hit the server in one POST. Escape or a click outside the grid cancels.
```

- [ ] **Step 3: Add a "Layout-shift slots" subsection**

After the existing `### Run timer display` section, before `### "New board" gate`, insert:

```markdown
### Layout-shift slots

To prevent the grid from jumping when transient UI appears, two ancestors of the board hold reserved space:

- **Armed banner** — a permanent `min-h-[1.75rem]` flex container above the grid. The chip inside renders only when `activePowerUp` is set, but the slot height never changes.
- **Game-over panel** — a permanent `min-h-[6.5rem] sm:min-h-[5.5rem]` block beneath the grid. The win/loss panel fills the slot when the run ends; during play the slot is empty whitespace. This avoids reflowing the verse builder beneath the board.
```

- [ ] **Step 4: Bump the manifest `lastVerified` date**

In `CLAUDE.md`, locate the JSON manifest. In the `unmasked` domain entry, update `lastVerified` from its current date to `"2026-04-29"`.

- [ ] **Step 5: Run lint + typecheck**

```bash
npm run lint
npm run typecheck
```

Expected: both exit 0. (Lint covers Markdown only loosely; mainly checking no JS/TS regressed.)

- [ ] **Step 6: Stage and ask**

```bash
git add docs/unmasked/frontend.md CLAUDE.md
git status
```

Say: **"Task 7 done — docs updated and manifest stamped. Want me to commit the full set, or commit per-task?"** Wait for authorization. The doc-sync Stop hook will pass cleanly because the docs were updated alongside the code.

---

## Self-review — done before saving

- **Spec coverage:**
  - Reserved slot for armed banner → Task 1 ✓
  - Reserved slot for game-over → Task 2 ✓
  - Floating popover with edge-flip + escape + outside-click → Task 5 ✓
  - Tile-ref plumbing → Task 3 ✓
  - Grid container made relative → Task 4 ✓
  - Removal of inline chooser → Task 6 ✓
  - Doc + manifest update → Task 7 ✓
  - Toolbar status text retained for screen readers → Task 6 confirms it stays ✓
  - Trade-off "empty whitespace during play" called out in spec → Task 2 step 4 acknowledges it ✓
- **No placeholders:** every code block contains real code; every step has an exact command or precise edit.
- **Type consistency:** `tileRefs` is `Map<number, HTMLElement | null>`; the chooser receives `anchor: HTMLElement | null` — match. `gridContainerRef` is `HTMLDivElement | null`; chooser's `gridContainer` is typed as `HTMLElement | null` (HTMLDivElement is a subtype) — fine.
- **Risks called out:** resize/scroll handled in Task 5 via `ResizeObserver` + `scroll` listener; slot heights are estimates noted in Task 2 for follow-up tweaking.
