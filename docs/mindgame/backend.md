# mindgame — backend

## Pure engine — [lib/games/mindgame/engine.ts](../../lib/games/mindgame/engine.ts)

Self-contained logic module. No `mongoose`, no `next/*`, no DOM. Importable from both client and server.

### Key exports

| Export | Purpose |
|---|---|
| `EngineKey` types: `BoardVariant`, `MindgameGoal`, `Cell`, `MindgameState` | TypeScript types |
| `FIXED_BOARD_10`, `FIXED_BOARD_8` | Board constants (rows, cols, playerCount, blocked, diagonalNodes) |
| `getFixedBoard(variant)` | Pick a board constant |
| `getDiagonalEdges(variant)` | Adjacency pairs for UI connector lines |
| `createInitialState(goal, variant)` | Build a starting state with a goal-specific scramble |
| `cloneMindgameState` | Deep clone (Set/Map members) |
| `stepIsAllowed(state, from, to)` | Single-step move validity |
| `stepPin(state, pin, target)` | Single-step transition (returns new state or null) |
| `applyPath(state, pin, path)` | Apply a multi-step path |
| `shortestPath(state, pin, target)` | BFS through orthogonal + valid diagonal edges |
| `isWinning(state)` | Win check (per goal mode) |
| `serializePositions`, `deserializePositions` | Map ↔ array |
| `serializeBlocked`, `deserializeBlocked`, `serializeDiagonalNodes`, `deserializeDiagonalNodes` | Set ↔ array |
| `getFixedBoardPersistSnapshot(variant)` | `{ blocked: [{r,c}], diagonalNodes: [{r,c}] }` for stale-detection |
| `boardsMatchPersisted(blocked, diagonalNodes, variant)` | Compare a save's snapshot vs current engine layout |

### Move validity

`stepIsAllowed` checks:
1. Target is in bounds.
2. Target isn't a wall.
3. Move is orthogonal (Manhattan distance 1) **OR** diagonal where **both endpoints** are in `diagonalNodes`.

Diagonal moves require both vertices to be diagonal-eligible. A pin standing on a non-diagonal vertex can't step diagonally even if the destination is diagonal-eligible. Symmetric check.

### BFS shortest path

`shortestPath(state, pin, target)` runs BFS from the pin's current vertex through `neighborsFromVertex` (orth + valid diagonals, skipping occupied vertices including walls and other pins). Returns the path or `null`. The path includes both endpoints.

### Win check

```ts
export function isWinning(state: MindgameState): boolean {
  // every pin on center column, then goal-order top-to-bottom
}
```

For `sort_desc`: pins ordered high→low top-to-bottom; ascending the indices means the order is "wrong". `sort_asc`: opposite. `odd_even`: odds first (preserving their order), then evens (preserving theirs).

### Initial scramble

`fixedInitialPositions(goal, variant)` places pins at slots 0..N-1 on the center column, but instead of pin index = slot, it assigns pins via `creativePinAtVerticalSlot` — a goal-specific zig-zag that ensures the start position isn't already winning. If the scramble accidentally wins (rare), pins 0 and 1 are swapped as a safety.

## API route — [app/api/mindgame/state/route.ts](../../app/api/mindgame/state/route.ts)

Two methods: GET (load), POST (save).

### Auth

Both methods call `requireCampAuthIfEnabled()`. Same logic as Unmasked: returns true if the gate is off; otherwise checks `youthcamp_camp_auth=1`. No team cookie required — the request body / query carries `sessionId` + `teamId` directly.

### POST behavior

Upserts on `{ clientKey, sessionId, teamId }`. Stores the full state snapshot (positions, walls, diagonals, goal, moves). The tuple is the unique compound key — a missing session/team uses `null`.

The route does **not** validate that positions are reachable, that walls match the engine, or that the goal is supported. It's a dumb upsert.

### GET behavior

Returns the most recent (`sort({updatedAt: -1})`) saved doc for the tuple, or `null`.

## Why no `/api/mindgame/action` endpoint

Mindgame moves are computed entirely in the client. The server does not enforce gameplay rules — there's no anti-cheat surface (a player faking a winning state changes nothing about the camp leaderboard, since `mindgame.weight === 0`). All persistence is "checkpoint" style.

Compare with [Unmasked](../unmasked/architecture.md), where the server **does** own gameplay rules (heart bookkeeping, lie reveals) because power-up redemption codes affect inventory and a malicious client could grant itself extra hearts.
