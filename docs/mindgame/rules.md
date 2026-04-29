# mindgame — rules

## MUST

- **The engine module must remain pure.** No imports of `mongoose`, `next/*`, browser APIs, or React. It must work on both client and server.
- **Diagonal moves require `diagonalNodes` membership at BOTH endpoints.** `stepIsAllowed` enforces this.
- **Walls (`blocked`) are impassable for moves AND for path planning.** `neighborsFromVertex` skips them. Don't bypass.
- **The compound key `(clientKey, sessionId, teamId)` is unique.** Always upsert by this triple.
- **Every save must include the current `blocked` and `diagonalNodes` snapshot.** This is required for stale-detection on load. Don't omit them to save bytes.
- **Persist after every successful move.** Moves are entirely client-side; if persistence drops, the player loses progress on reload.
- **Use `applyPath` over a sequence of `stepPin` calls only when the engine returned the path** (i.e. the path is known valid). Don't accept arbitrary `Cell[]` from user input as a path — validate via `shortestPath`.

## MUST NOT

- **Never validate moves on the server.** Mindgame is intentionally trust-the-client. The server is a checkpoint store, not a referee.
- **Never expose anonymous mindgame state across browsers.** The localStorage-derived `clientKey` is per-browser. Don't add a "shared anonymous" path.
- **Never write a different layout to `blocked` / `diagonalNodes` than what the live engine has.** Doing so trips `boardsMatchPersisted` and the next load will discard the save.
- **Never reuse a `clientKey` between variants.** Standard and Quick must keep separate suffixes (`:10` / `:8`). Without the suffix, switching variants trampoles saves.
- **Never let `goal` or `variant` change without re-creating the engine state.** Switching mid-game without `createInitialState` would leave you with a board mismatch (e.g. positions for 10 pins on an 8-pin board).
- **Never reach into `MindgameState.positions` directly outside the engine module.** The shape (`Map<number, Cell>` in-engine, `[{pinIndex, r, c}]` on the wire) is engine-private. Use `serializePositions` / `deserializePositions`.
- **Never assume `mindgame` participates in scoring.** The seed config sets `weight: 0`. Treat scoring elsewhere; mindgame's "win" is a UI affordance, not a leaderboard event.
