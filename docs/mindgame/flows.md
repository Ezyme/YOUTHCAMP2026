# mindgame — flows

## Move flow (client-side, no server round-trip)

```mermaid
sequenceDiagram
  actor User
  participant Board as MindgameBoard
  participant Engine as engine.ts (pure)
  participant Persist as /api/mindgame/state POST

  User->>Board: tap pin
  Board->>Board: setSelected(pinIndex)
  User->>Board: tap target vertex
  Board->>Engine: shortestPath(state, pin, target)
  Engine-->>Board: Cell[] (or null if no path)
  alt path exists
    Board->>Engine: applyPath(state, pin, path)
    Engine-->>Board: new state
    Board->>Board: setState + push undo snapshot
    Board->>Board: setMoves(moves + 1)
    alt isWinning(new state)
      Board->>User: "you win" toast
    end
    Board-->>Persist: debounced POST (positions, moves)
  else
    Board->>User: "no path" toast
  end
```

The engine is pure — every step is computed locally. Persistence is fire-and-forget, debounced.

## Persistence flow

```mermaid
sequenceDiagram
  participant Board as MindgameBoard
  participant API as POST /api/mindgame/state
  participant DB as MongoDB

  Board->>API: { clientKey, sessionId?, teamId?, positions, moves, blocked, diagonalNodes, goal, ... }
  API->>API: requireCampAuthIfEnabled
  API->>DB: MindgameState.findOneAndUpdate({clientKey, sessionId, teamId}, $set, {upsert: true, new: true})
  DB-->>API: doc
  API-->>Board: 200 doc
```

Upsert keyed by the unique tuple. The route doesn't validate `positions` against the engine — it stores whatever the client sends. The client is the source of truth.

## Load flow

```mermaid
sequenceDiagram
  actor User
  participant Page as /play/mindgame (SSR)
  participant Board as MindgameBoard (client)
  participant API as GET /api/mindgame/state
  participant Engine as engine.ts

  User->>Page: GET /play/mindgame
  Page->>Page: read cookies, resolve session+team
  Page->>Board: render with sessionId, teamId
  Board->>Board: createInitialState(goal, variant) (default scramble)
  Board->>API: GET /api/mindgame/state?clientKey=...&sessionId=...&teamId=...
  API->>API: requireCampAuthIfEnabled
  API->>DB: MindgameState.findOne({clientKey, sessionId, teamId}).sort({updatedAt:-1})
  DB-->>API: doc | null
  API-->>Board: doc | null
  alt doc exists
    Board->>Engine: boardsMatchPersisted?
    alt match
      Board->>Engine: deserializePositions(doc.positions)
      Board->>Board: setState(...)
    else stale
      Board->>User: "saved layout outdated, starting fresh" toast
      Board->>Board: keep default scramble
    end
  end
```

If the persisted `blocked` or `diagonalNodes` arrays don't match the live engine layout, the save is discarded.

## Undo flow

Pure-client. Each successful move pushes a snapshot onto a `useRef` stack (capped at 400). Undo pops a snapshot and re-renders. Undo doesn't immediately persist — the next move (or explicit save action) will.

## Win flow

When `isWinning(state)` is true after a move:
- `<MindgameBoard>` shows a success toast.
- The win is *not* recorded as a `GameResult` — mindgame is part of the Amazing Race station, scored by facilitators based on observed completion. The in-app state is informational.
