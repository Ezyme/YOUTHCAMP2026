# mindgame — gotchas

## 1. Saves are silently discarded when wall layout changes

After editing `BLOCKED_COORDS_*` or `DIAGONAL_COORDS_*` in the engine, every existing save fails `boardsMatchPersisted` and is reset on next load. The toast says something generic ("starting fresh"), and the player loses progress.

This is the right behavior for a code change but surprising mid-camp. **Don't tweak the wall layout while a camp is running.**

## 2. `clientKey` collisions across browsers (anonymous play)

Anonymous play stores `clientKey` in `localStorage`. Two browsers on the same device (different profiles) get different keys — fine. But if a player logs in mid-game (becomes session-bound), the new `clientKey` is `group:<sessionId>:<teamId>:10` — totally different from the anon `mg-<rand>`. **The mid-game state does not migrate.** You start a fresh board.

Workaround today: don't switch login state mid-game.

## 3. Variant suffix is a string, not a number — `:8` vs `:10`

The suffix is concatenated as `:${variant === "quick" ? "8" : "10"}`. If you ever add a third variant, pick a suffix that doesn't conflict. `:80` would parse as "8" + "0". Today there are only two variants, so safe.

## 4. The route doesn't validate `positions`

POST accepts any `positions` array. A malicious or buggy client can save "every pin on (0,0)" and the next reload will dutifully restore that nonsense. The engine's `applyPath` won't crash on it — but `isWinning` may return false forever.

Why no validation: mindgame doesn't score, so cheating is a non-issue. **Don't generalize this trust to a future engine that does score.**

## 5. `goal` and `variant` switches reset the board

This is intentional — different goals/variants have different starting positions. But it's surprising the first time: tweaking the goal mid-puzzle wipes your progress.

UX-wise, the form has confirm-before-switch logic in the future (TBD). Today it's instant.

## 6. The unique compound index includes `null`s

`MongoDB`'s default behavior treats `null` as a unique key value. So two anonymous saves with `sessionId: null, teamId: null` would conflict on `clientKey`. The engine sidesteps this by using a per-browser random `clientKey` — collisions are vanishingly rare.

If you ever explicitly try to bootstrap multiple anonymous saves with `clientKey: "default"`, they will conflict.

## 7. `MindgameStateSchema` does NOT delete the cached model in dev

Unlike `UnmaskedState` and `PowerUpCode`, `MindgameState` doesn't have the dev-HMR enum-reset guard. There's no enum field on this schema today. If you ever add one, copy the pattern from [models.ts:472](../../lib/db/models.ts#L472).

## 8. Undo doesn't persist eagerly

The undo stack is in-memory only. Undoing a move bumps the React state but doesn't immediately POST. The next persistence opportunity (next move, reset, variant switch) writes the post-undo state. If the page crashes mid-undo, the server keeps the pre-undo state.

Acceptable trade-off given mindgame's weight: 0 status. Not acceptable for a scored engine.

## 9. SSR `clientKey` is the literal `"ssr"` — don't persist it

`makeClientKey` returns `"ssr"` when `window` is undefined. The component calls this only on the client, so it shouldn't reach the server. But if a future change moves `makeClientKey` to a server component, an `ssr` key could land in the DB. Filter that out if you ever add server-side persistence.

## 10. The undo cap of 400 is silent

After 400 moves, the oldest snapshot is dropped. The UI doesn't warn. If you ever play a 500-move game, you can't undo back to move 1. In practice, mindgame puzzles solve in <50 moves. If the cap ever bites, raise it — there's plenty of memory.

## 11. `isPlayable` and `weight` are decoupled

A `mindgame` `GameDefinition` is `isPlayable: true, weight: 0`. The play page renders the board (because isPlayable) but the leaderboard ignores it (because weight: 0). Don't conflate these flags. If you flip `isPlayable: false`, `/play/mindgame` shows a "coming soon" placeholder instead of the board, even though the engine is still there.
