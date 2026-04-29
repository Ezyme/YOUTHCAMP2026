# mindgame — recipes

## Recipe: add a new board variant (size)

1. **Define the constants** in [engine.ts](../../lib/games/mindgame/engine.ts):
   ```ts
   const BLOCKED_COORDS_<N>: readonly [number, number][] = [ /* wall coords */ ];
   const DIAGONAL_COORDS_<N>: readonly [number, number][] = [ /* diagonal-eligible coords */ ];
   const DIAGONAL_EDGES_<N>: readonly DiagonalEdgePair[] = [ /* UI connector pairs */ ];
   ```
2. **Build the board:**
   ```ts
   export const FIXED_BOARD_<N> = makeFixedBoard(rows, cols, playerCount, BLOCKED_COORDS_<N>, DIAGONAL_COORDS_<N>);
   ```
3. **Update `BoardVariant` union and the dispatch helpers:**
   ```ts
   export type BoardVariant = "standard" | "quick" | "<new>";
   ```
   Add cases to `getFixedBoard()` and `getDiagonalEdges()`.
4. **Update the `clientKey` suffix logic** in [mindgame-board.tsx](../../components/games/mindgame/mindgame-board.tsx) so this variant gets its own suffix (e.g. `:6`).
5. **Update the variant `<select>`** in `<MindgameBoard>` to expose the new option.
6. **Test:** verify the initial scramble doesn't accidentally win, BFS finds paths, win check works for all goals.

## Recipe: add a new goal mode

1. Update the union: `export type MindgameGoal = "sort_desc" | "sort_asc" | "odd_even" | "<new>";`
2. Add a case to `isWinning(state)` ([engine.ts:385](../../lib/games/mindgame/engine.ts#L385)).
3. Add a case to `creativePinAtVerticalSlot(slot, playerCount, goal)` so the initial scramble lays out pins in a non-winning order. The pattern: ensure the scramble is "scrambled relative to the goal".
4. Update the goal `<select>` UI in `<MindgameBoard>`.
5. Verify the safety swap at the end of `fixedInitialPositions` still kicks in if the scramble accidentally wins.

## Recipe: change the wall layout

1. Edit `BLOCKED_COORDS_<N>` (or `DIAGONAL_COORDS_<N>`) for the variant you're modifying.
2. **Important:** existing saves carry the old wall snapshot. After the change:
   - On load, `boardsMatchPersisted` will return `false`.
   - The client will discard the save and start fresh.
   - Players will lose mid-game progress.
3. Communicate the change in release notes if mid-camp.
4. Update `DIAGONAL_EDGES_<N>` if you changed diagonal-eligibility — the UI connector lines must match.
5. Test that BFS still finds a path from start to a sample target.

## Recipe: enable mindgame scoring

Currently `mindgame.weight === 0` so it doesn't show on the leaderboard. To enable:

1. **Change the seed** in [`lib/seed/camp-games.ts`](../../lib/seed/camp-games.ts) — set `weight` to a non-zero value.
2. **Add server-side validation** to `/api/mindgame/state` POST. Today it's trust-the-client. With weight > 0, you need to:
   - Validate `positions` is reachable from `createInitialState(goal, variant)` via legal moves only.
   - Or: store moves as a sequence + validate replay on the server.
3. **Decide how to record results.** `GameResult` rows track placement; mindgame is timeless. Probably need a "first to win" facilitator-judged event, or per-team move-count comparison.
4. **Update [scoring/architecture.md](../scoring/architecture.md)** with the new flow.

This is a non-trivial change — likely 1–2 days of work.

## Recipe: persist mindgame from a different surface (e.g. a tablet kiosk)

1. The route accepts any `clientKey`. Pick a stable one for the kiosk, e.g. `kiosk-station-1`.
2. Pass it to `<MindgameBoard>` somehow (URL param + custom override). Today the component derives `clientKey` internally from sessionId/teamId/localStorage; you'd add a prop.
3. Or: bypass `<MindgameBoard>` and POST directly from your kiosk app.

The route doesn't care who the caller is — only that the auth gate passes (when on).

## Recipe: clear all anonymous saves

Anonymous saves have `sessionId: null, teamId: null`. They are not touched by `/api/admin/reset-camp` (which filters by `sessionId`).

To clear them:
- Mongo shell: `db.mindgamestates.deleteMany({ sessionId: null, teamId: null })`.
- Or: increment the localStorage key (`youthcamp_client_key` → `youthcamp_client_key_v2`) and saves orphan automatically.

## Recipe: wire mindgame into a different layout (e.g. embedded)

The component is self-contained. You can drop `<MindgameBoard sessionId={...} teamId={...} />` anywhere. It'll fetch and persist via the global API. There's no layout dependency — `next-themes` and Tailwind classes inherit from the root layout.

For an iframe or Storybook scenario where there's no API, mock fetch or pass a different `clientKey` to keep saves out of the production DB.
