# Unmasked: Verse-tile fade + Builder drag-to-reorder + Rules rewrite — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **CRITICAL — repo rule (CLAUDE.md):** **Never auto-commit.** Each task ends with a "stage and ask" step. Do NOT run `git commit`, `git add` (the no-auto-commit hook also blocks staging), `git push`, `gh pr create`, `gh pr merge`, or any commit/push/PR/merge command unless the human user authorizes it in their **most recent** message using one of `commit`, `push`, `merge`, `make a PR`, `create a PR`, `open a PR`, `ship it`. The PreToolUse hook blocks these — but you must follow the rule on your own.
>
> **Doc-sync rule (CLAUDE.md):** Code edits to `components/`, `lib/`, `app/`, or top-level `middleware.ts`/`next.config.ts` MUST be paired with corresponding `docs/<domain>/` updates in the same dispatch. The Stop hook will block your completion otherwise.
>
> **No test runner exists** in this repo. Verification = `npm run lint`, `npm run typecheck`, and manual `npm run dev` against the affected page.
>
> **Earlier unstaged work:** This plan runs on top of unstaged changes from a previous task series (the layout-shift slots + Truth Radar floating chooser). Do NOT touch those changes; they're outside this plan's scope. The diff piles up — the user will commit batches at their own pace.

**Goal:** Three independent UX improvements to the Unmasked game, shipping together: (1) verse tiles celebrate for 2 s on reveal then fade to look like normal tiles, (2) the verse-builder row uses drag-to-reorder via `@dnd-kit/sortable` instead of up/down chevron buttons, and (3) the Identity Minefield rules render as actual Markdown (not literal `**bold**`) and the copy is rewritten to be shorter and structured.

**Architecture:** All UI work centers on [components/games/unmasked/unmasked-board.tsx](../../../components/games/unmasked/unmasked-board.tsx) (verse-tile render branch + verse-builder row). The rules change is two unrelated files: [app/games/[slug]/page.tsx](../../../app/games/[slug]/page.tsx) (renderer swap) and [lib/seed/camp-games.ts](../../../lib/seed/camp-games.ts) (content rewrite). Three runtime deps + one dev dep are added; one Tailwind plugin directive added to `app/globals.css`.

**Tech stack:** Next.js 16 App Router, React 19, Tailwind 4, TypeScript. New deps: `react-markdown`, `remark-gfm`, `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `@tailwindcss/typography` (dev).

**Specs:**
- [docs/superpowers/specs/2026-04-29-unmasked-verse-tile-fade-design.md](../specs/2026-04-29-unmasked-verse-tile-fade-design.md)
- [docs/superpowers/specs/2026-04-29-unmasked-verse-builder-dnd-design.md](../specs/2026-04-29-unmasked-verse-builder-dnd-design.md)
- [docs/superpowers/specs/2026-04-29-unmasked-rules-markdown-design.md](../specs/2026-04-29-unmasked-rules-markdown-design.md)

---

## File map

| File | Phase | Role |
|---|---|---|
| `package.json` + `package-lock.json` | A, C | Add 5 runtime + 1 dev dep |
| `app/globals.css` | A | Add `@plugin "@tailwindcss/typography";` directive |
| `app/games/[slug]/page.tsx` | A | Replace `<pre>{rulesMarkdown}</pre>` with `<ReactMarkdown remarkPlugins={[remarkGfm]}>` |
| `lib/seed/camp-games.ts` | A | Rewrite Identity Minefield `rulesMarkdown` |
| `components/games/unmasked/unmasked-board.tsx` | B, C | Fade state + helper + render-branch split (B); DndContext + SortableFragmentChip + handler + chevron removal (C) |
| `docs/unmasked/frontend.md` | D | Document fade celebration + new builder DnD interaction |
| `docs/games-shared/` (if mentions rendering) | D (if needed) | Update rules-rendering reference |
| `CLAUDE.md` | D | Bump `unmasked.lastVerified` if not already today |

---

## Phase A — Rules + Markdown rendering

### Task A1: Install dependencies + wire Tailwind plugin

**Files:**
- Modify: `package.json`, `package-lock.json` (via `npm install`)
- Modify: `app/globals.css`

- [ ] **Step 1: Install runtime + dev deps**

```bash
cd "c:/Codes/YouthCamp Game"
npm install react-markdown remark-gfm
npm install -D @tailwindcss/typography
```

Expected: `npm install` completes with no peer-dep errors. If a peer-dep error appears for React 19, check the package's CHANGELOG and use `npm install --legacy-peer-deps` only as a last resort. Stop and report if you have to.

- [ ] **Step 2: Add the Tailwind typography plugin directive**

Open `app/globals.css`. The first line is `@import "tailwindcss";`. Immediately on the next line, add:

```css
@plugin "@tailwindcss/typography";
```

The full top of the file becomes:

```css
@import "tailwindcss";
@plugin "@tailwindcss/typography";

/* Brand: teal primary, coral/red accent — Identity Camp / Pastor's Corner palette */
:root {
  ...
```

- [ ] **Step 3: Smoke-test the build**

```bash
npm run typecheck
```

Expected: exit 0. (Lint is deferred until A4 because we'll have a few other small edits to bundle.)

### Task A2: Replace the rules renderer with `<ReactMarkdown>`

**Files:**
- Modify: `app/games/[slug]/page.tsx` (the `rulesMarkdown` block, around lines 81-87)

- [ ] **Step 1: Read the full file to find current imports**

Read `app/games/[slug]/page.tsx` end-to-end (~100 lines). Confirm where existing imports live (top of file).

- [ ] **Step 2: Add the imports**

At the top of the file with the other imports, add:

```tsx
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
```

Place them with the other 3rd-party imports (alphabetically or matching existing import order).

- [ ] **Step 3: Replace the `<pre>` rendering**

Find:

```tsx
      {g.rulesMarkdown ? (
        <article className="prose prose-zinc mt-6 max-w-none text-sm dark:prose-invert">
          <pre className="whitespace-pre-wrap rounded-xl bg-muted p-4 font-sans text-foreground">
            {g.rulesMarkdown}
          </pre>
        </article>
      ) : null}
```

Replace with:

```tsx
      {g.rulesMarkdown ? (
        <article className="prose prose-zinc mt-6 max-w-none rounded-xl bg-muted p-4 text-sm dark:prose-invert">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {g.rulesMarkdown}
          </ReactMarkdown>
        </article>
      ) : null}
```

The card classes (`rounded-xl bg-muted p-4`) move from `<pre>` to `<article>`; the `<pre>` is gone; `<ReactMarkdown>` parses the body.

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

Expected: exit 0. If TS complains about `react-markdown` types, check that `@types/react-markdown` is bundled in v9+ (it is — types are inline). Stop and report if errors.

### Task A3: Rewrite the Identity Minefield rules

**Files:**
- Modify: `lib/seed/camp-games.ts` (around line 173)

- [ ] **Step 1: Locate the existing `rulesMarkdown` field**

In `lib/seed/camp-games.ts`, find the entry for the `unmasked` game and its `rulesMarkdown` field. Today's value is one long single-quoted string:

```ts
    rulesMarkdown:
      "**Identity Minefield** — default **20×20** board (~**28%** lies on **Intense**). Multiple Scripture passages (no references), fragment stack & builder, passage checks for score. Tap to reveal, long-press to flag. Use the side power-up rail for hover tips and locked/redeemed status. Amazing Race codes can unlock hearts, reveals, scouts, shields, safe openings, Truth Radar, Lie Pin, Verse Compass, and Gentle Step.",
```

- [ ] **Step 2: Replace with the new copy**

Substitute with a backtick template literal so newlines are readable:

```ts
    rulesMarkdown: `**Identity Minefield**

Reveal every safe tile on the 20×20 board (~28% lies on Intense). Tap to reveal, long-press to flag a suspected lie.

Once the board is cleared:
- Drag fragments from the **Stack** into the **Builder row** in reading order.
- Tap **Check passage** to score. Each wrong check adds 30 s to your time and reveals a citation clue.

**Amazing Race codes** unlock hearts, reveals, scouts, shields, safe openings, Truth Radar, Lie Pin, Verse Compass, and Gentle Step.`,
```

If the existing line uses single quotes, switching to backticks may require escaping nothing (no backticks or `${}` in the new content). If your editor flags any lint rule about preferring single quotes, ignore — the multiline content justifies the backtick form.

### Task A4: Verify Phase A

- [ ] **Step 1: Run lint + typecheck**

```bash
npm run lint
npm run typecheck
```

Expected: typecheck exit 0. Lint may have **pre-existing** errors in unrelated files (5 errors + 1 warning baseline from previous work in `mindgame-board.tsx`, `scoring-panel.tsx`, `unmasked-teams-admin.tsx`, `theme-toggle.tsx`). The count must NOT increase from this Phase. If a new error appears in `app/games/[slug]/page.tsx` or `lib/seed/camp-games.ts`, fix the cause before continuing.

- [ ] **Step 2: Manual verification**

```bash
npm run dev
```

Open `/games/unmasked` (logged in as a team if the camp gate is on, or with the gate off). Until the admin clicks **Seed**, the rendered rules will still be the OLD copy from MongoDB — but the rendering layer should show MARKDOWN: a single bolded "Identity Minefield" without literal asterisks. Open the admin panel → Seed. Reload `/games/unmasked` — see the new four-paragraph layout with bullet list and bold emphasis. Confirm:

1. **Identity Minefield** displays bold (not `**Identity Minefield**`).
2. The bullet list under "Once the board is cleared:" renders with actual bullet markers.
3. The card background is rounded with `bg-muted` padding.
4. Toggle dark mode — text remains readable.

Note: do NOT hand-edit the database. Run the admin Seed button.

- [ ] **Step 3: Stage and ask**

The no-auto-commit hook prevents `git add`. Run `git status` to surface the files; report to the user:

> "Phase A done — Markdown rendering wired and Identity Minefield rules rewritten. Files changed: `package.json`, `package-lock.json`, `app/globals.css`, `app/games/[slug]/page.tsx`, `lib/seed/camp-games.ts`. Want me to commit Phase A as a checkpoint?"

Wait for explicit `commit` / `push` / `ship it` authorization before staging or committing.

---

## Phase B — Verse-tile fade celebration

### Task B1: Add fade state, timer ref, helper, cleanup

**Files:**
- Modify: `components/games/unmasked/unmasked-board.tsx`

- [ ] **Step 1: Add state and timer ref**

Find the existing state declaration block (around line 366-415, where `useState`/`useRef` calls live). After the existing `tileRefSetters` `useMemo` and `gridContainerRef` decl (added in the previous task series), add:

```tsx
  const [freshVerseTiles, setFreshVerseTiles] = useState<Set<number>>(() => new Set());
  const verseFadeTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
```

- [ ] **Step 2: Add the duration constant**

Above the `UnmaskedBoard` component (around line 220, with other module-level constants), add:

```tsx
const FRESH_VERSE_DURATION_MS = 2000;
```

- [ ] **Step 3: Add the `celebrateVerseReveals` helper**

Inside `UnmaskedBoard`, near the other `useCallback`-wrapped helpers (e.g. `commitOptimistic` around line 859 or the verse helpers around line 1341-1356), add:

```tsx
  const celebrateVerseReveals = useCallback(
    (indices: Iterable<number>) => {
      if (!board) return;
      const toAdd: number[] = [];
      for (const i of indices) {
        if (board.tiles[i]?.kind !== "verse") continue;
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
    },
    [board, freshVerseTiles],
  );
```

- [ ] **Step 4: Add the unmount cleanup effect**

Near the other `useEffect` blocks in `UnmaskedBoard` (look for a section with `useEffect` like the timer/persist hooks), add:

```tsx
  useEffect(() => {
    const timers = verseFadeTimers.current;
    return () => {
      for (const t of timers.values()) clearTimeout(t);
      timers.clear();
    };
  }, []);
```

(Capturing `verseFadeTimers.current` into a local `timers` variable inside the effect avoids the React lint warning about ref access in cleanup.)

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```

Expected: exit 0.

### Task B2: Wire celebration into reveal/reconcile/retry

**Files:**
- Modify: `components/games/unmasked/unmasked-board.tsx`

- [ ] **Step 1: Locate the optimistic-reveal call site**

Find the function around line 908 that calls `applyRevealLocal`. The existing flow:

```tsx
  const { result, next } = applyRevealLocal(
    ...
  );
  ...
  commitOptimistic(next);
```

After `commitOptimistic(next)`, if `result.type === "number"` or `result.type === "verse"`, the engine returned a `floodRevealed: number[]`. Add immediately after `commitOptimistic(next)`:

```tsx
      if ("floodRevealed" in result) {
        celebrateVerseReveals(result.floodRevealed);
      }
```

(`"floodRevealed" in result` is true for the "number" and "verse" cases; false for the "lie" case. The helper itself filters by `tile.kind === "verse"`, so it's safe to pass non-verse indices in.)

- [ ] **Step 2: Locate the second reveal hook (e.g. `doActionServer`)**

Some power-up actions also reveal tiles via the server response (Truth Radar, Verse Compass, Gentle Step, Safe Opening). Find each call site that handles a server response with `result.revealedIndices` or `result.floodRevealed` (around lines 1046, 1051, 1132, 1137, 1155). After each successful state commit, add:

```tsx
      celebrateVerseReveals(/* the array of newly revealed indices for this action */);
```

For example at line 1155 area (Truth Radar):

```tsx
      flashTiles([origin, ...revealedIndices], "truth_radar", 2400);
      celebrateVerseReveals(revealedIndices);
```

For Safe Opening (line 1137 area):

```tsx
      flashTiles(result.revealedIndex != null ? [result.revealedIndex] : [], "safe_opening", 2200);
      celebrateVerseReveals(result.revealedIndex != null ? [result.revealedIndex] : []);
```

Use the same pattern at each site. The helper is idempotent and cheap.

- [ ] **Step 3: Wire `maybeReconcile` for any other server-side reveals**

Find `maybeReconcile` (around line 833). It replaces local state with the server's authoritative `revealed` set. Update its body to compute newly-revealed indices and celebrate them:

```tsx
  const maybeReconcile = useCallback(
    (s: ServerState | null) => {
      if (!s) return;
      const prevRevealed = revealed;
      // ...existing body that calls setRevealed(new Set(s.revealed))...
      const newlyRevealed: number[] = [];
      for (const i of s.revealed) {
        if (!prevRevealed.has(i)) newlyRevealed.push(i);
      }
      if (newlyRevealed.length > 0) celebrateVerseReveals(newlyRevealed);
    },
    [/* existing deps */, celebrateVerseReveals, revealed],
  );
```

(Adapt to the actual function shape — read the existing `maybeReconcile` body first, find where it sets revealed, and place the diff + celebration after that.)

- [ ] **Step 4: Wire `handleRetry` to clear**

Find `handleRetry` (around line 651). Inside the success branch where local state is reset, add:

```tsx
      for (const t of verseFadeTimers.current.values()) clearTimeout(t);
      verseFadeTimers.current.clear();
      setFreshVerseTiles(new Set());
```

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```

Expected: exit 0.

### Task B3: Split the verse-tile render branch

**Files:**
- Modify: `components/games/unmasked/unmasked-board.tsx` (around lines 1771-1819)

- [ ] **Step 1: Read the current verse-tile render branch**

Read lines 1771-1819 of `components/games/unmasked/unmasked-board.tsx`. Confirm the structure: a className `cls`, a `verseClue` element, and two return branches (`needsFocalTileFromGrid` ? button : div).

- [ ] **Step 2: Branch on `freshVerseTiles.has(i)`**

Replace the `if (isVerse) { ... }` block with a version that branches on the freshness flag. The "fresh" branch keeps today's exact JSX. The "matured" branch falls through to the SAME render shape as the revealed-empty branch immediately below it (line 1821+) — `bg-white border-transparent` with the adjacent-lies number when > 0.

Concrete shape:

```tsx
            if (isVerse) {
              const isFresh = freshVerseTiles.has(i);

              if (isFresh) {
                // === EXISTING fresh-tile rendering, unchanged ===
                const cls = `verse-magic-tile relative flex aspect-square min-h-0 items-center justify-center overflow-hidden rounded-sm border-2 border-amber-200/80 transition-[background-color,border-color,color] duration-700 ease-out ${
                  isHighlighted && highlightMode === "verse_compass" ?
                    "ring-2 ring-violet-400 ring-offset-1 ring-offset-emerald-50"
                  : ""
                } ${needsFocalTileFromGrid ? `${focalRevealHover} hover:ring-2` : ""}`;
                const verseClue =
                  tile.adjacentLies > 0 ? (
                    <span
                      className={`relative z-10 text-[0.75rem] font-bold tabular-nums drop-shadow-[0_1px_1px_rgba(255,255,255,0.85)] sm:text-sm ${numberColor(tile.adjacentLies)}`}
                    >
                      {tile.adjacentLies}
                    </span>
                  ) : (
                    <Sparkles
                      className="relative z-10 size-4 text-amber-50 opacity-95 drop-shadow-[0_0_8px_rgba(250,232,255,0.95)] sm:size-[1.15rem]"
                      strokeWidth={2}
                    />
                  );
                return needsFocalTileFromGrid ? (
                  <button
                    key={i}
                    ref={tileRefSetters[i]}
                    type="button"
                    disabled={status !== "playing"}
                    onClick={() => void handleTileClick(i)}
                    className={cls}
                    title="Passage tile — number shows adjacent lies"
                  >
                    <Sparkles
                      className="pointer-events-none absolute right-0.5 top-0.5 z-0 size-2.5 opacity-55 text-white"
                      aria-hidden
                    />
                    {verseClue}
                  </button>
                ) : (
                  <div
                    key={i}
                    ref={tileRefSetters[i]}
                    className={cls}
                    title="Passage tile — number shows adjacent lies"
                  >
                    <Sparkles
                      className="pointer-events-none absolute right-0.5 top-0.5 z-0 size-2.5 opacity-55 text-white"
                      aria-hidden
                    />
                    {verseClue}
                  </div>
                );
              }

              // === MATURED: render like a revealed-empty tile ===
              const cls = `flex aspect-square min-h-0 items-center justify-center rounded-sm border border-transparent bg-white transition-[background-color,border-color,color] duration-700 ease-out ${
                isHighlighted && (highlightMode === "reveal" || highlightMode === "safe_opening" || highlightMode === "gentle_step") ?
                  "animate-pulse border border-emerald-400 bg-emerald-100"
                : isHighlighted && highlightMode === "verse_compass" ?
                  "ring-2 ring-violet-400 ring-offset-1 ring-offset-white"
                : ""
              } ${needsFocalTileFromGrid ? focalRevealHover : ""}`;
              return needsFocalTileFromGrid ? (
                <button
                  key={i}
                  ref={tileRefSetters[i]}
                  type="button"
                  disabled={status !== "playing"}
                  onClick={() => void handleTileClick(i)}
                  className={cls}
                  title="Passage tile — number shows adjacent lies"
                >
                  {tile.adjacentLies > 0 ? (
                    <span
                      className={`text-[0.65rem] font-bold sm:text-xs ${numberColor(tile.adjacentLies)}`}
                    >
                      {tile.adjacentLies}
                    </span>
                  ) : null}
                </button>
              ) : (
                <div
                  key={i}
                  ref={tileRefSetters[i]}
                  className={cls}
                  title="Passage tile — number shows adjacent lies"
                >
                  {tile.adjacentLies > 0 ? (
                    <span
                      className={`text-[0.65rem] font-bold sm:text-xs ${numberColor(tile.adjacentLies)}`}
                    >
                      {tile.adjacentLies}
                    </span>
                  ) : null}
                </div>
              );
            }
```

(The matured branch keeps `verse_compass` highlight support so Verse Compass still highlights matured verse tiles correctly. The `transition-[background-color,border-color,color] duration-700 ease-out` is added on BOTH branches so that as the className flips, the colors interpolate.)

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: exit 0.

### Task B4: Verify Phase B

- [ ] **Step 1: Run lint + typecheck**

```bash
npm run lint
npm run typecheck
```

Expected: typecheck exit 0; lint matches the baseline (no new errors in `unmasked-board.tsx`).

- [ ] **Step 2: Manual verification**

```bash
npm run dev
```

Load `/play/unmasked` as a team. Reveal a verse tile. Watch:
1. Tile shows amber border + sparkle/number for ~2 s.
2. Around 700 ms: colors interpolate from amber to white.
3. After 2 s: tile is indistinguishable from a revealed safe tile (white bg, optional number).
4. Reveal a flood-fill chain that hits multiple verse tiles — each fades on its own timer.
5. Reveal a verse tile via Verse Compass power-up — celebration runs the same way.
6. Reload the page mid-game — already-revealed verse tiles render directly in matured state (no celebration on reload).
7. Click "Retry / New board" mid-celebration — no leftover amber tiles, no console errors.

- [ ] **Step 3: Stage and ask**

Run `git status`. Say:

> "Phase B done — verse-tile fade celebration wired. File changed: `components/games/unmasked/unmasked-board.tsx`. Want me to commit Phase B as a checkpoint?"

Wait for explicit authorization.

---

## Phase C — Verse builder drag-to-reorder

### Task C1: Install dnd-kit dependencies

**Files:**
- Modify: `package.json`, `package-lock.json` (via `npm install`)

- [ ] **Step 1: Install**

```bash
cd "c:/Codes/YouthCamp Game"
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

Expected: install succeeds. If a peer-dep error mentions React 19, check the latest dnd-kit version (`npm view @dnd-kit/core peerDependencies`). v6+ supports React 19. Stop and report if you cannot install cleanly.

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: exit 0.

### Task C2: Wire DndContext + SortableContext + handler

**Files:**
- Modify: `components/games/unmasked/unmasked-board.tsx`

- [ ] **Step 1: Add imports**

At the top of `components/games/unmasked/unmasked-board.tsx`, add to the existing import block:

```tsx
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
```

- [ ] **Step 2: Define `SortableFragmentChip` inside `UnmaskedBoard`**

The chip closes over local helpers (`palette`, `removeFromAssembly`, `canAssembleVerses`). Define it as an inner function inside `UnmaskedBoard`, near the other inner helpers (e.g. just above the JSX return, around line 1280):

```tsx
  function SortableFragmentChip({
    id,
    frag,
    palette,
    disabled,
    onTapReturn,
  }: {
    id: string;
    frag: VerseFragRow;
    palette: (typeof VERSE_PALETTE)[number];
    disabled: boolean;
    onTapReturn: () => void;
  }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
      id,
      disabled,
    });

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

(Replace `(typeof VERSE_PALETTE)[number]` with whatever the actual palette type is — read the file to find `VERSE_PALETTE`'s declaration and use the matching shape. If `VERSE_PALETTE` is `[{ ring, bg, text, chip }, ...]` typed as inferred-tuple, the indexed-access `(typeof VERSE_PALETTE)[number]` is correct.)

- [ ] **Step 3: Sensors and drag-end handler**

Inside `UnmaskedBoard`, near the top of the function body (with the other hook calls), add:

```tsx
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleAssemblyDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const ids = assemblyFragments.map((f, i) => `${f.index}-${i}`);
      const from = ids.indexOf(String(active.id));
      const to = ids.indexOf(String(over.id));
      if (from < 0 || to < 0) return;
      moveWithinAssembly(from, to);
    },
    [assemblyFragments, moveWithinAssembly],
  );
```

(`moveWithinAssembly` already exists; if it's a regular `function` declaration not wrapped in `useCallback`, the dependency reference is still valid — TypeScript will resolve it.)

- [ ] **Step 4: Replace the Builder row's chip JSX**

In the Builder row block (around lines 2090-2147), find the `assemblyFragments.map(...)` body. Replace the entire mapper block — including the `<ChevronRight>` separators, the up/down chevron column, and the inner button — with a `<DndContext>` wrapping a `<SortableContext>` wrapping a list of `<SortableFragmentChip>` components.

Replace this:

```tsx
                  <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2">
                    {assemblyFragments.map((frag, i) => {
                      const palette = VERSE_PALETTE[verseColorIndex(frag.verseKey, usedVerseKeys)];
                      const last = i === assemblyFragments.length - 1;
                      return (
                        <div key={`${frag.index}-${i}`} className="flex items-center gap-1.5">
                          {i > 0 ? (
                            <ChevronRight ... />
                          ) : null}
                          <div className={`...two-button column...`}>
                            <div className="flex shrink-0 flex-col self-stretch border-r border-amber-200/70 dark:border-amber-800/60">
                              <button ... ChevronUp ... />
                              <button ... ChevronDown ... />
                            </div>
                            <button onClick={() => removeFromAssembly(i)} ...>
                              {frag.text}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
```

With:

```tsx
                  <DndContext
                    sensors={dndSensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleAssemblyDragEnd}
                  >
                    <SortableContext
                      items={assemblyFragments.map((f, i) => `${f.index}-${i}`)}
                      strategy={horizontalListSortingStrategy}
                    >
                      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2">
                        {assemblyFragments.map((frag, i) => {
                          const palette = VERSE_PALETTE[verseColorIndex(frag.verseKey, usedVerseKeys)];
                          return (
                            <SortableFragmentChip
                              key={`${frag.index}-${i}`}
                              id={`${frag.index}-${i}`}
                              frag={frag}
                              palette={palette}
                              disabled={!canAssembleVerses}
                              onTapReturn={() => removeFromAssembly(i)}
                            />
                          );
                        })}
                      </div>
                    </SortableContext>
                  </DndContext>
```

- [ ] **Step 5: Simplify the hint text**

Find the conditional hint at lines 2080-2088:

```tsx
                {assemblyFragments.length > 1 ? (
                  <span className="text-[10px] text-amber-700/90 dark:text-amber-400/90">
                    Use ↑ ↓ to reorder · tap a line to return it to the stack
                  </span>
                ) : (
                  <span className="text-[10px] text-amber-700/90 dark:text-amber-400/90">
                    Tap a line to return it to the stack
                  </span>
                )}
```

Replace with the unconditional version:

```tsx
                <span className="text-[10px] text-amber-700/90 dark:text-amber-400/90">
                  Drag to reorder · tap a line to return it to the stack
                </span>
```

- [ ] **Step 6: Remove unused chevron imports**

Search for `ChevronUp` and `ChevronDown` in `components/games/unmasked/unmasked-board.tsx`. After Step 4 they should appear only in the import statement. Remove them from the `lucide-react` import block:

Change:

```tsx
import {
  ...
  ChevronDown,
  ChevronRight,
  ChevronUp,
} from "lucide-react";
```

To:

```tsx
import {
  ...
  ChevronRight,
} from "lucide-react";
```

(Verify `ChevronRight` is still used elsewhere in the file — search for it. If it's also no longer used after Step 4, remove it too.)

- [ ] **Step 7: Typecheck**

```bash
npm run typecheck
```

Expected: exit 0. If TS errors mention missing types from `@dnd-kit`, run `npm install --save-dev @types/...` only if required (dnd-kit ships its own types; this should not be needed).

### Task C3: Verify Phase C

- [ ] **Step 1: Lint + typecheck**

```bash
npm run lint
npm run typecheck
```

Expected: typecheck exit 0; lint matches baseline.

- [ ] **Step 2: Manual verification**

```bash
npm run dev
```

Load `/play/unmasked` and assemble a few fragments. Verify:

1. Drag a fragment chip with mouse — visual feedback (scale + shadow + opacity) during drag, drops in new position.
2. Drag a chip on touch (use Chrome DevTools "Touch" mode or a real phone) — same behavior.
3. Tap a chip without moving — returns to the stack.
4. Try to drag with `canAssembleVerses === false` (board not yet cleared, fragments visible from a prior session) — chips look greyed and don't drag.
5. Use keyboard: tab to a chip, press Space, arrow keys, Space — moves a chip without mouse.
6. Press Esc mid-drag — chip snaps back, no reorder.
7. Hint text reads "Drag to reorder · tap a line to return it to the stack" regardless of count.
8. No ChevronUp / ChevronDown buttons visible. Inter-chip ChevronRight separators removed.

- [ ] **Step 3: Stage and ask**

Run `git status`. Say:

> "Phase C done — drag-to-reorder wired, old chevron buttons removed. Files changed: `components/games/unmasked/unmasked-board.tsx`, `package.json`, `package-lock.json`. Want me to commit Phase C as a checkpoint?"

Wait for explicit authorization.

---

## Phase D — Documentation + manifest

### Task D1: Update `docs/unmasked/frontend.md`

**Files:**
- Modify: `docs/unmasked/frontend.md`

- [ ] **Step 1: Update the verse-builder section**

Find the section (search for `Verse builder`) describing the up/down reorder mechanism. Replace any reference to `up/down buttons` or `↑ ↓` with drag-to-reorder. Suggested phrasing:

```markdown
### Verse builder

A horizontal strip below the board. Players drag fragments from a "stack" panel into the strip, and reorder within the strip by dragging chips (`@dnd-kit/sortable`, ~6 px activation distance so taps don't trigger drag). Tap a chip without moving to return it to the stack. The order matters. "Check passage" POSTs `action: "check_verse"` with `assemblyIndices`.

On success: fragment chips animate to the "Restored passages" list, and `verseScore` ticks up.
On failure: penalty seconds accrue, and a toast shows the reference clue (e.g. "Psalm 139:14") as a hint without revealing the full text.
```

- [ ] **Step 2: Add a "Verse-tile celebration" subsection**

After the "Reveal/flag flow" section, add:

```markdown
### Verse-tile celebration

When a verse tile is revealed during play, it shows the magical styling (amber border, center sparkle/number, corner sparkle) for 2 s, then fades to look identical to a normal revealed safe tile. State: `freshVerseTiles: Set<number>` plus a `verseFadeTimers` ref of `setTimeout` ids. Population: `applyRevealLocal`'s `result.floodRevealed`, plus a diff in `maybeReconcile` for server-side reveals (Truth Radar, Verse Compass, etc.). Cleanup: `handleRetry` clears all timers; component unmount also clears.

Reload mid-game: `freshVerseTiles` is empty on mount, so already-revealed verse tiles render in matured state immediately — no replay celebration.
```

### Task D2: Update CLAUDE.md manifest

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Bump `unmasked.lastVerified`**

In `CLAUDE.md`, locate the JSON Domain Manifest. Find the `unmasked` entry. If `lastVerified` is not already `"2026-04-29"`, update it to today's date.

If a separate domain (`games-shared` or `seed`) covers `app/games/[slug]/page.tsx` or `lib/seed/camp-games.ts`, also bump that domain's `lastVerified`. Read the manifest entries for `games-shared` and `seed` to confirm.

- [ ] **Step 2: Lint + typecheck**

```bash
npm run lint
npm run typecheck
```

Expected: typecheck exit 0; lint matches baseline.

- [ ] **Step 3: Stage and ask**

Run `git status`. Say:

> "All three phases done — fade celebration, drag-to-reorder, Markdown rules. Docs and manifest updated. Want me to commit the full set, or commit phase by phase?"

Wait for explicit authorization. The doc-sync Stop hook should pass cleanly because docs were updated alongside code.

---

## Self-review

- **Spec coverage:**
  - Verse-tile fade — Tasks B1 (state/helper), B2 (wiring), B3 (render split). ✓
  - DnD verse builder — Tasks C1 (install), C2 (wire + remove old). ✓
  - Rules Markdown rendering — Tasks A1 (install + plugin), A2 (renderer swap). ✓
  - Rules content rewrite — Task A3. ✓
  - Re-seed step — called out in A4 manual verification. ✓
  - Docs updated — Task D1. ✓
  - Manifest stamped — Task D2. ✓
- **No placeholders:** every code block contains real code. The `(typeof VERSE_PALETTE)[number]` palette type in C2 may need adapting to the file's actual type; the task instructs the engineer to read the file and use the matching shape — explicit guidance, not a placeholder.
- **Type consistency:** `freshVerseTiles: Set<number>`; `verseFadeTimers: Map<number, ReturnType<typeof setTimeout>>`; `celebrateVerseReveals(indices: Iterable<number>)` — all aligned across B1, B2, B3.
- **Risks called out:** install peer-dep failures (A1, C1); typography plugin compatibility (A1); palette type resolution (C2). Mitigations specified.
- **No-auto-commit:** every "Stage and ask" step waits for the user. The plan never assumes authorization.
