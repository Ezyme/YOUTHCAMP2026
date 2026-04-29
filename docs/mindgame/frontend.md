# mindgame — frontend

## `<MindgameBoard />` — [components/games/mindgame/mindgame-board.tsx](../../components/games/mindgame/mindgame-board.tsx)

Client component. The single board used both on `/play/mindgame` and from the camp dashboard's group view.

### Props

```ts
type Props = {
  sessionId?: string;
  teamId?: string;
  groupLabel?: string; // shown in header when shared
};
```

### Internal state

- `state: MindgameState` — engine state (rows, cols, positions, blocked, diagonalNodes, goal).
- `selected: number | null` — currently picked pin.
- `moves: number` — counter, persisted.
- `undoStackRef` (useRef) — capped at 400 snapshots.
- `goal`, `variant` — controlled via UI selectors.

### `clientKey` strategy

```ts
function makeClientKey(sessionId?, teamId?, variant): string {
  if (sessionId && teamId) return `group:${sessionId}:${teamId}:${variant === "quick" ? "8" : "10"}`;
  // anon: localStorage("youthcamp_client_key") or generate `mg-<rand>`
}
```

Group play shares the same save across browsers signed in as the same team. Anonymous play sticks to a single browser via localStorage.

### UI affordances

- **Tap a pin** to select.
- **Tap a destination vertex** to walk there. The engine's `shortestPath` BFS finds an orth+diagonal path; `applyPath` applies it move-by-move.
- **Undo** button — pops the snapshot stack.
- **Reset** button — calls `createInitialState` with current goal/variant.
- **Variant select** — switches between Standard (10 pins, 10×3) and Quick (8 pins, 8×3). Reseeds the board on change.
- **Goal select** — `sort_desc` / `sort_asc` / `odd_even`. Reseeds on change.

### Persistence

`persist(next, moveCount)` POSTs to `/api/mindgame/state`. Called after every successful move. There is currently no debounce — every move triggers one POST. With <500ms moves and tiny payloads this is fine.

### Win toast

Calls `isWinning(state)` after each move. On true → `showSuccess("Solved!")`. Doesn't lock the UI — the player can keep moving / reset.

### Variant + goal change clears state

Switching variant or goal:
1. Calls `createInitialState(newGoal, newVariant)`.
2. Resets `selected`, `moves` to 0.
3. Clears undo history.
4. Persists the fresh state to the new variant's `clientKey` (keys differ by suffix).

This preserves the previous variant's save — switching back restores it.

## Component file structure

`<MindgameBoardInner>` is the actual board renderer; `<MindgameBoard>` is a thin wrapper that holds the variant + goal state and rerenders the inner with new keys when those change. This avoids tangling the variant change with the engine state's reset logic.

## SVG rendering

The board is SVG. Walls are drawn as filled circles at blocked vertices; diagonal-eligible vertices are drawn with a faint connector line between paired endpoints (from `getDiagonalEdges(variant)`). Pins are circles labeled with their index.

## What this component does NOT do

- It does not poll the server. Once loaded, all state is local until the next reload.
- It does not show a leaderboard or score. Mindgame's `GameDefinition` has `weight: 0` — it doesn't contribute to the leaderboard.
- It does not handle multi-pin selection or batch moves.
