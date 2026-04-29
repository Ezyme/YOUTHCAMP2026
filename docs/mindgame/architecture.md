# mindgame — architecture

## Pure engine + thin shell

The engine ([lib/games/mindgame/engine.ts](../../lib/games/mindgame/engine.ts)) is a **pure** TypeScript module. No DB, no React, no I/O. Every function takes state in and returns state out (plus helpers for serialization).

The shell:
- API route ([app/api/mindgame/state/route.ts](../../app/api/mindgame/state/route.ts)) parses + validates + writes a `MindgameState` document.
- React component ([components/games/mindgame/mindgame-board.tsx](../../components/games/mindgame/mindgame-board.tsx)) holds in-memory state, calls engine functions, debounces persistence.

This separation makes the engine cheaply testable and lets the same logic (e.g. `isWinning`) run on both client and server.

## Lattice model (vertices, not cells)

The board is a grid of **vertices** (intersections), not cells. A 10×3 lattice has 30 vertices in 10 rows × 3 columns; a pin sits on a vertex; a step moves to an adjacent vertex (orthogonal always; diagonal only when both endpoints are diagonal-eligible).

Why vertices: the puzzle's signature look is pins-on-line-crossings with walls *at* crossings rather than between cells. Diagonal bridges cross choke rows by hopping wing → spine → opposite-wing.

## Board variants

Two fixed board shapes:

| Variant | Grid | Pins | Walls | Diagonal-eligible vertices |
|---|---|---|---|---|
| `standard` | 10×3 | 10 | 12 | 6 (two bridges across r4 and r8 chokes) |
| `quick` | 8×3 | 8 | 8 | 6 (two X-crossing bridges across r2 and r5) |

Layouts are hardcoded constants ([engine.ts:16-85](../../lib/games/mindgame/engine.ts#L16-L85)). They are deliberately fixed — no procedural generation, no admin-editable layout. The seed entry ([camp-games.ts](../../lib/seed/camp-games.ts)) doesn't carry layout data; the engine knows it.

## Goals (win conditions)

Three goal modes ([engine.ts:1](../../lib/games/mindgame/engine.ts#L1)):
- `sort_desc` — pins ordered high→low, top-to-bottom on the center column.
- `sort_asc` — pins low→high, top-to-bottom.
- `odd_even` — odd pins first, even pins second, both blocks in their own order on the center column.

Initial scramble ([engine.ts:187-251](../../lib/games/mindgame/engine.ts#L187-L251)) places pins in a goal-specific zig-zag that *isn't* already winning (with a swap fallback if the scramble accidentally satisfies the win check).

## Persistence triple: `(clientKey, sessionId, teamId)`

`MindgameState` is keyed by `{ clientKey, sessionId, teamId }` — a unique compound index. Each tuple holds at most one save:

- **Anonymous play** (no session/team): `clientKey = "mg-<random>"` stored in `localStorage` so the same browser resumes; `sessionId` and `teamId` are null.
- **Camp-bound play** (signed in, picked a team): `clientKey = "group:<sessionId>:<teamId>:<variant-suffix>"`. Multiple browsers signed in as the same team see the same shared board.

The variant suffix (`:8` for quick, `:10` for standard) keeps two saves per team — one per board size.

## Saved board snapshot for stale detection

Each save also includes the wall + diagonal-eligible coordinates as plain `[{r,c}]` arrays. On load, the client compares the persisted layout to the current `getFixedBoardPersistSnapshot(variant)` via `boardsMatchPersisted`. A mismatch means the engine layout has changed since the save was written — the client discards the save and starts fresh.

This protects against the developer changing the wall pattern in `engine.ts` and breaking pre-existing saves.

## Layer position

```
[Browser] /play/mindgame → <MindgameBoard /> (client)
                            │
                            ├── engine.ts (pure)  — selection, path preview, step, win check
                            ├── /api/mindgame/state GET (load saved positions)
                            └── /api/mindgame/state POST (debounced persist)
                                       │
                                       ▼
                            [lib/db/models.ts → MindgameState]
```

There is **no `/api/mindgame/action`** — moves don't round-trip the server. The client owns gameplay; the server only persists snapshots. This is fine because mindgame's "score" is informational (move count), not competitive — there's no anti-cheat surface to defend.
