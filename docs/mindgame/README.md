# mindgame — Grid planner puzzle

Lattice-walk puzzle where pins on a vertical column must be sorted into a goal order by stepping one vertex at a time through a maze of walls and diagonal bridges.

## What lives in this folder

- [lib/games/mindgame/engine.ts](../../lib/games/mindgame/engine.ts) — pure logic (board layout, BFS shortest path, win check, goal-specific scrambles).
- [components/games/mindgame/mindgame-board.tsx](../../components/games/mindgame/mindgame-board.tsx) — `<MindgameBoard />` client component.
- [app/api/mindgame/state/route.ts](../../app/api/mindgame/state/route.ts) — GET/POST persistence.

## Docs in this folder

| File | What it covers |
|---|---|
| [architecture.md](./architecture.md) | Engine purity, the lattice model, board variants, persistence triple |
| [models.md](./models.md) | `MindgameState` schema notes (compound unique on `clientKey + sessionId + teamId`) |
| [flows.md](./flows.md) | Move flow, persistence flow, undo flow |
| [frontend.md](./frontend.md) | `<MindgameBoard />` — selection, BFS path preview, undo, persistence debounce |
| [backend.md](./backend.md) | Pure-engine helpers, what the route does/doesn't do |
| [api.md](./api.md) | `/api/mindgame/state` GET/POST |
| [rules.md](./rules.md) | Diagonals only at diagonal-eligible vertices, walls impassable, win conditions |
| [patterns.md](./patterns.md) | Pure engine + thin route, board snapshot persistence, clientKey strategy |
| [recipes.md](./recipes.md) | Add a new board variant · add a new goal mode · change wall layout |
| [gotchas.md](./gotchas.md) | Stale-board detection, anonymous play, `clientKey` collisions, dev-HMR resets |

## Related domains

- [games-shared](../games-shared/README.md) — `/play/mindgame` page dispatches into `<MindgameBoard />`.
- [db](../db/README.md) — `MindgameState` lives in `lib/db/models.ts`.
- [camp-auth](../camp-auth/README.md) — API gates mindgame state writes.
- [seed](../seed/README.md) — `mindgame` `GameDefinition` row comes from `CAMP_GAMES`.
