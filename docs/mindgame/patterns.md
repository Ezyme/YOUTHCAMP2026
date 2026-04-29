# mindgame — patterns

## 1. Pure engine + thin route

The engine module ([engine.ts](../../lib/games/mindgame/engine.ts)) is pure. The API route is a 50-line shim. The component is the orchestrator. Whenever you see a `lib/games/<engine>/engine.ts` file, expect this layering.

Why it's good: pure modules are unit-testable without any mocking. Both client and server can run `isWinning(state)` to check.

## 2. Set/Map for in-engine state, arrays on the wire

The engine uses `Set<string>` for blocked/diagonal vertex keys (fast lookup) and `Map<number, Cell>` for pin positions. The wire format flattens to `[{r, c}]` and `[{pinIndex, r, c}]` because Mongo stores arrays, not Sets.

`serialize…` / `deserialize…` helpers cross the boundary. Never call `JSON.stringify(set)` — you get `{}`.

## 3. clientKey suffix for variant separation

```ts
return variant === "quick" ? `${base}:8` : `${base}:10`;
```

The suffix is part of the unique key. Without it, switching board sizes overwrites the previous variant's save. Same browser, different boards = different saves.

## 4. Stale-board detection via persisted snapshot

The save carries `blocked + diagonalNodes`. On load, compare via `boardsMatchPersisted`. If false, the engine layout has changed (developer edit) and the save is no longer valid for the current board. Discard, start fresh.

This is a generic "save schema versioning" pattern: instead of a `version` field, store enough of the schema in the save to detect drift.

## 5. Component-driven persistence (no auto-save thread)

Persistence is triggered only by user actions (move, undo, reset, variant/goal change). There's no setInterval, no beforeunload handler. Trade-off: simpler code, occasional risk of losing the very last move if the page crashes mid-write.

## 6. `useRef` for the undo stack

Undo snapshots aren't React state — they're stored in `useRef<{ state, moves }[]>`. Why: the stack is *append-and-replay*, never compared, never read declaratively. State updates would force re-renders on every push.

The stack length is mirrored in `useState(undoLen)` for the "Undo (N)" button label, since UI does need to react to that.

## 7. Initial scramble derived deterministically from goal

`createInitialState(goal, variant)` is deterministic — no randomness. Same goal + variant always start the same way. Reasoning: the scramble is part of the puzzle, not a per-session randomness; testing is easier with a stable starting state.

## 8. Goals encoded as a sum type with switch dispatch

```ts
export type MindgameGoal = "sort_desc" | "odd_even" | "sort_asc";
```

`isWinning` and `creativePinAtVerticalSlot` both branch on this string union. To add a fourth goal, update the union, then add cases to both functions. The exhaustiveness isn't checked at compile time today (the `if/else` chain returns false at the end), so test coverage matters when adding goals.

## 9. SVG board, no canvas

The board is rendered as SVG (vertices, walls, diagonal connectors, pins). SVG suits the lattice geometry — vertices are easy to click, scaling is crisp, and the board is small (≤30 vertices). Don't switch to Canvas for marginal performance.

## 10. No anti-cheat surface

Mindgame's `weight: 0` means a manipulated state can't affect the leaderboard. The trust-the-client approach is justified. If you ever change `weight > 0`, you'd need to add server-side validation — at which point all the engine logic that runs on the client today would also need to run on the server (or be moved entirely server-side).
