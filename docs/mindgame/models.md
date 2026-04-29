# mindgame — models

## `MindgameState`

Defined at [lib/db/models.ts:282-309](../../lib/db/models.ts#L282-L309). Field reference also in [db/models.md](../db/models.md#mindgamestate).

Saved per `(clientKey, sessionId, teamId)`. Either or both of session/team may be null (anonymous play).

| Field | Type | Notes |
|---|---|---|
| `clientKey` | String, required | Differentiates saves; format `mg-<rand>` (anon) or `group:<sessionId>:<teamId>:<variantSuffix>` (camp-bound) |
| `sessionId` | ObjectId → Session, default null | |
| `teamId` | ObjectId → Team, default null | |
| `gridRows`, `gridCols` | Number, required | 10×3 standard, 8×3 quick |
| `playerCount` | Number, required | Pin count (10 or 8) |
| `positions` | `[{ pinIndex, r, c }]` | Pin positions on the lattice |
| `blocked` | `[{ r, c }]` | Wall vertex coordinates **as of save time** — used for stale detection |
| `diagonalNodes` | `[{ r, c }]` | Diagonal-eligible vertex coordinates as of save time |
| `goal` | String, required | `"sort_desc" \| "sort_asc" \| "odd_even"` |
| `moves` | Number, default 0 | Move counter |

**Index:** `{ clientKey: 1, sessionId: 1, teamId: 1 }` — **unique compound** ([models.ts:311-314](../../lib/db/models.ts#L311-L314)).

## Why `blocked` and `diagonalNodes` are persisted with each save

The board layout (walls + diagonals) is in source code, not in the DB. But persisting a snapshot lets the client detect "this save was written against an older engine layout":

```ts
boardsMatchPersisted(saved.blocked, saved.diagonalNodes, variant)
```

If false, the client discards the save and starts fresh. See [`boardsMatchPersisted` at engine.ts:488](../../lib/games/mindgame/engine.ts#L488).

This costs a few bytes per save but protects against regressions when the dev changes wall coordinates.

## clientKey format conventions

| Caller context | clientKey |
|---|---|
| Anon, browser | `mg-<8 random base36 chars>` |
| Anon, SSR | `ssr` (no real persistence — just so the schema validates) |
| Camp-bound | `group:<sessionId>:<teamId>:10` (standard) or `:8` (quick) |

The `:10` / `:8` suffix is critical — without it, switching between quick and standard would trample saves. See [`makeClientKey` at mindgame-board.tsx:26-41](../../components/games/mindgame/mindgame-board.tsx#L26-L41).

## What is NOT in the model

- **Walls / diagonals are not configurable per save.** The persistence is read-only telemetry of the engine state at write time.
- **No timer.** Mindgame doesn't track time — only moves.
- **No win flag.** Win is a derived predicate (`isWinning(state)`) computed on the client.

## Cascade behavior

`/api/admin/reset-camp` deletes `MindgameState.deleteMany({ sessionId })` for the active session. Anonymous saves (no sessionId) are not touched by reset.
