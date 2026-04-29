# Unmasked: Verse builder — drag-to-reorder + UI refresh

**Date:** 2026-04-29
**Scope:** UI-only change to `components/games/unmasked/unmasked-board.tsx` plus three new dependencies.
**Out of scope:** server, API, scoring, models, other games, engine logic, the verse-tile celebration fade (separate spec).

## Problem

The verse builder row uses ChevronUp / ChevronDown buttons on every fragment chip to reorder ([unmasked-board.tsx:2111-2132](../../../components/games/unmasked/unmasked-board.tsx#L2111-L2132)). The two buttons take up width on the chip, the only way to move a fragment by more than one step is to repeatedly click, and the affordance is awkward on touch devices. The screenshot the player sees is busy: each chip carries a stacked up/down control, an inter-fragment chevron-right separator, and the text — three visual elements per item.

A direct drag-and-drop interaction is the universal mental model for ordered lists.

## Goal

Replace the up/down buttons with whole-chip drag-to-reorder. Tap (no drag movement) keeps its current "return to stack" behavior. The hint text and inter-fragment separators are simplified accordingly.

## Non-goals

- Changing the verse fragment delivery flow (still triggered by revealing a verse tile on the board).
- Changing how `assemblyFragments` is persisted, stored, or reconciled with the server.
- Changing the visual identity of the chips beyond the drag affordance (colors, palette, dark-mode handling stay).
- Drag-and-drop in any OTHER part of the app (this is a localized change to one component).

## Library

We add three packages:

```
@dnd-kit/core
@dnd-kit/sortable
@dnd-kit/utilities
```

Total ~12 KB gzip. Maintained, MIT-licensed, touch + keyboard accessible out of the box. No alternative considered (the user picked this in brainstorming).

## Design

### DnD context

Wrap only the Builder row's chip container in:

```tsx
<DndContext
  sensors={sensors}
  collisionDetection={closestCenter}
  onDragEnd={handleAssemblyDragEnd}
>
  <SortableContext
    items={assemblyFragments.map((f, i) => `${f.index}-${i}`)}
    strategy={horizontalListSortingStrategy}
  >
    {assemblyFragments.map((frag, i) => (
      <SortableFragmentChip key={`${frag.index}-${i}`} ... />
    ))}
  </SortableContext>
</DndContext>
```

The chip container already wraps with `flex flex-wrap items-center gap-x-1.5 gap-y-2`. dnd-kit's `horizontalListSortingStrategy` works well for wrapped flex rows; if drag-across-rows feels jumpy in browser, switch to `rectSortingStrategy` (free-form 2-D). Out of scope to test both; pick `horizontalListSortingStrategy` as v1 default.

We deliberately do NOT include `restrictToParentElement` (which lives in the separate `@dnd-kit/modifiers` package) — for wrapped flex layouts the default unconstrained drag behaves more naturally (the chip can briefly leave the row's bounding box mid-drag without snapping). Adding `@dnd-kit/modifiers` is a follow-up if real users want it.

### Sensors

```tsx
const sensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
);
```

The 6 px activation distance is the wedge that disambiguates drag from tap. Below 6 px the gesture falls through to the chip's `onClick` (existing return-to-stack handler). Above 6 px, dnd-kit takes over.

### `SortableFragmentChip` — new inline sub-component

Defined inside `UnmaskedBoard` (it closes over local helpers like `removeFromAssembly`, `palette`, `verseColorIndex`, `usedVerseKeys`, `canAssembleVerses`):

```tsx
function SortableFragmentChip({
  id,
  frag,
  index,
  palette,
  disabled,
  onTapReturn,
}: {
  id: string;
  frag: VerseFragRow;
  index: number;
  palette: VersePalette;
  disabled: boolean;
  onTapReturn: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : 1,
  };

  return (
    <button
      ref={setNodeRef}
      style={style}
      type="button"
      onClick={onTapReturn}
      disabled={disabled}
      className={`max-w-full rounded-xl border px-2.5 py-1.5 text-left text-[0.7rem] font-medium leading-snug shadow-sm transition ${palette.ring} ${palette.bg} ${palette.text} ${
        disabled ? "cursor-not-allowed opacity-60" : "cursor-grab active:cursor-grabbing"
      } ${isDragging ? "ring-2 ring-primary/40 shadow-md scale-[1.02]" : ""}`}
      {...attributes}
      {...listeners}
      title="Drag to reorder · tap to return to stack"
    >
      {frag.text}
    </button>
  );
}
```

The chip IS the drag handle (no separate handle icon — the affordance is the cursor change + the visual feedback while dragging).

### Reorder handler

```tsx
function handleAssemblyDragEnd(event: DragEndEvent) {
  const { active, over } = event;
  if (!over || active.id === over.id) return;
  const ids = assemblyFragments.map((f, i) => `${f.index}-${i}`);
  const from = ids.indexOf(String(active.id));
  const to = ids.indexOf(String(over.id));
  if (from < 0 || to < 0) return;
  moveWithinAssembly(from, to); // existing helper handles state + persistence
}
```

`moveWithinAssembly` already exists ([unmasked-board.tsx](../../../components/games/unmasked/unmasked-board.tsx); search for the function name) and is what the old up/down buttons called. We reuse it.

### What gets removed

- The two-button column (`<div className="flex shrink-0 flex-col self-stretch border-r border-amber-200/70 ...">` containing ChevronUp + ChevronDown) — gone.
- The `ChevronRight` separators between fragments — gone.
- The conditional hint text branch ("Use ↑ ↓ to reorder · tap a line to return to the stack") — replaced with the unconditional "Drag to reorder · tap a line to return to the stack" since the affordance is consistent regardless of fragment count.
- `ChevronUp` and `ChevronDown` imports if no other call site uses them. (`ChevronRight` may still be used elsewhere — verify before removing the import.)

### Disabled states

`canAssembleVerses` is the existing flag for "board cleared, builder unlocked". When false:
- `disabled` prop on `useSortable` blocks dragging.
- `cursor-not-allowed opacity-60` styling makes it look inert.
- The existing tap-to-return is also already gated on `canAssembleVerses`; keep that.

### Hint text

The existing branch at [unmasked-board.tsx:2080-2088](../../../components/games/unmasked/unmasked-board.tsx#L2080-L2088) becomes one line:

```tsx
<span className="text-[10px] text-amber-700/90 dark:text-amber-400/90">
  Drag to reorder · tap a line to return it to the stack
</span>
```

(No conditional — the affordance is the same whether there's one fragment or ten.)

## Accessibility

- `KeyboardSensor` + `sortableKeyboardCoordinates` give space-to-pick-up, arrow-keys-to-move, space-to-drop without writing custom handlers.
- The chip stays a `<button>` — keyboard users still get tap-to-return via Enter/Space (when not in drag mode).
- Live announcements: dnd-kit emits ARIA live-region announcements for screen readers by default. We do not customize the strings (English defaults are fine for v1).

## Edge cases

| Case | Behavior |
|---|---|
| Player drags chip, releases on the same spot | dnd-kit fires `onDragEnd` with `over.id === active.id`; handler short-circuits. ✓ |
| Player drags chip outside the parent flex container | `restrictToParentElement` modifier clamps the visual transform; if released outside, the chip snaps back. ✓ |
| Player taps chip without moving 6 px | PointerSensor never activates; `onClick` fires; existing return-to-stack runs. ✓ |
| Fragment is added DURING a drag | `assemblyFragments` updates → SortableContext receives new `items` array → dnd-kit handles mid-drag list mutation gracefully (existing item's drag continues). ✓ |
| Player on touch screen does a long-press elsewhere on the page | No effect — only chip-targeted pointer-downs are sensed. ✓ |
| Server reconcile changes the order while drag in progress | Rare but possible. The drag is local visual transform until release; on release we call `moveWithinAssembly(from, to)` which uses the CURRENT assemblyFragments (post-reconcile), so the drag may produce an unexpected result. Acceptable for v1; in practice reconciles for verse assembly are user-driven. |

## Verification

No test runner. Manual checks via `npm run dev`:

1. Build a 3-fragment verse, drag fragment B to position 1 — order updates, tap-to-return still works on a separate gesture.
2. Tap a fragment without moving — returns to stack (no drag detected).
3. With `canAssembleVerses === false` (board not yet cleared) — fragments visible (if any auto-added — they aren't in current code, but in case) appear greyed and don't drag.
4. Use keyboard: tab to chip, press Space, arrow-right twice, press Space — chip moves two positions to the right.
5. On a phone, drag a chip across two rows — drop indicator follows; release reorders.
6. ESC mid-drag — drag cancels, chip snaps back. (dnd-kit default.)
7. The hint text always reads "Drag to reorder · tap a line to return it to the stack" regardless of fragment count.
8. The Builder row no longer renders ChevronUp / ChevronDown / ChevronRight elements.

## Files touched

| File | Change |
|---|---|
| `components/games/unmasked/unmasked-board.tsx` | DndContext + SortableContext + SortableFragmentChip; remove old chevron UI; updated hint text |
| `package.json` + `package-lock.json` | Three new deps under dependencies |
| `docs/unmasked/frontend.md` | Update "Verse builder" subsection: mention drag-to-reorder, drop the up/down reference |

## Risks

- **Bundle size** — ~12 KB gzip is acceptable for the polish gain on a core game interaction. Not a concern.
- **Dnd-kit and React 19** — current version (~6.x) supports React 19 (verified by maintainers in their changelog as of 2025). If install fails on peer deps, downgrade or upgrade per error message.
- **Touch on iOS Safari** — dnd-kit handles iOS touch events natively. The 6 px activation distance also helps reduce false-drag from scroll attempts.
- **Tailwind 4 + cursor utilities** — `cursor-grab` and `cursor-grabbing` are stock Tailwind 4 utilities. No config change needed.

## Rollback

Revert the commit. Three deps remain installed (cheap to leave; can be removed in a follow-up via `npm uninstall`).
