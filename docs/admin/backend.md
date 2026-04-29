# admin — backend

## `verifyAdminRequest()` — [lib/admin-auth.ts](../../lib/admin-auth.ts)

The single auth check used by every `/api/admin/*` handler.

```ts
export async function verifyAdminRequest(): Promise<boolean> {
  const secret = process.env.ADMIN_SECRET?.trim();
  if (!secret) return true;                 // dev: no secret = open
  const jar = await cookies();
  return jar.get("youthcamp_admin")?.value === secret;
}
```

### Behavior

- If `ADMIN_SECRET` is unset or all whitespace → returns `true` (open admin).
- Otherwise → returns `true` only if the `youthcamp_admin` cookie value **strictly equals** the secret.

Comparison uses `===` on the raw cookie value. Since the cookie holds the secret literally, this is effectively a "bearer token" model.

### Why no constant for the cookie name?

The cookie name `"youthcamp_admin"` is hardcoded in three places:
- [lib/admin-auth.ts:8](../../lib/admin-auth.ts#L8)
- [middleware.ts:39](../../middleware.ts#L39)
- [app/api/admin/login/route.ts:14](../../app/api/admin/login/route.ts#L14)
- [components/site-header.tsx:13](../../components/site-header.tsx#L13)

This is inconsistent with camp auth (which exports `CAMP_AUTH_COOKIE`). See [gotchas.md](./gotchas.md). If you ever rename, all four spots must change together.

## `lib/admin/plain-game-scoring.ts`

Strips Mongoose subdoc metadata for client-component props. `GameDefinition.scoring` is an embedded subdoc; serializing it directly leaks `_id` buffers and other internals that React server-to-client serialization rejects.

```ts
export function plainGameScoring(sc): GameScoring {
  return {
    maxPlacements: sc?.maxPlacements ?? 6,
    scoringMode: sc?.scoringMode ?? "placement_points",
    placementPoints: [...(sc?.placementPoints ?? [12, 11, 10, 9, 8, 7])],
    weight: sc?.weight ?? 1,
    ...(typeof sc?.manualPointsMax === "number"
      ? { manualPointsMax: sc.manualPointsMax }
      : {}),
  };
}
```

Call this in any server component that passes `scoring` to a client component. Used by `/admin/games/[id]/edit` and `/admin/scoring`.

## Login route — [`/api/admin/login`](../../app/api/admin/login/route.ts)

POST `{ secret }`. Behavior:

- If `ADMIN_SECRET` unset → returns 200 with a "no secret" message and **does not** set a cookie. (Dev convenience.)
- If body's `secret` doesn't match → 401.
- Otherwise → sets `youthcamp_admin=<ADMIN_SECRET>` (httpOnly, lax, /, 7 days) and returns 200.

Cookie maxAge: `60 * 60 * 24 * 7` (7 days, vs 14 for camp).

## Reset-camp route — [`/api/admin/reset-camp`](../../app/api/admin/reset-camp/route.ts)

POST. Wipes per-session play state for the active session. Calls `verifyAdminRequest()`.

Steps (parallel):
- `GameResult.deleteMany({ sessionId })`
- `MindgameState.deleteMany({ sessionId })`
- `UnmaskedState.deleteMany({ sessionId })`
- `PowerUpCode.updateMany({ sessionId }, { $set: { redeemedBy: [] } })`

**Does NOT touch:**
- `GameDefinition` (game configs are global)
- `Team` (rosters + login credentials)
- `Session` itself
- `PowerUpCode` rows (only their `redeemedBy` is cleared)

Returns counts: `deletedGameResults`, `deletedMindgameStates`, `deletedUnmaskedStates`, `powerUpCodesRedemptionsCleared`.

This is the "start a fresh camp run" button. After this, every team can replay every game from a clean slate, but the same redemption codes are still valid.

## Admin Unmasked routes

These four are the only `/api/admin/*` routes that touch Unmasked. They wrap engine functions from [`lib/games/unmasked/`](../../lib/games/unmasked/) so admin actions reuse the same invariants as gameplay.

### `GET /api/admin/unmasked/state` — [route.ts](../../app/api/admin/unmasked/state/route.ts)

Read-only spectator state for a `(sessionId, teamId)`. Runs `migrateLegacyUnmaskedState` on read so old saves are normalized. Does NOT bump `lastPlayActivityAt` — admin reads should not affect "team is actively playing" indicators.

### `POST /api/admin/unmasked/reset` — [route.ts](../../app/api/admin/unmasked/reset/route.ts)

Two actions:
- `action: "timer"` — reset only `startedAt` (now), `checkPassagePenaltySeconds` (0), `lastPlayActivityAt` (null). Board, hearts, redeemed codes preserved.
- `action: "board"` — calls `resetUnmaskedBoardKeepTimer` ([lib/games/unmasked/reset-board.ts](../../lib/games/unmasked/reset-board.ts)). Reshuffles the minefield + verses; preserves the run timer and re-applies redeemed codes to the inventory.

### `GET /api/admin/unmasked/teams` — [route.ts](../../app/api/admin/unmasked/teams/route.ts)

List every team's Unmasked status (hearts, shielded, revealed count, restored verses, etc.) for the dashboard.

### `POST /api/admin/unmasked/power-up-grant-all` — [route.ts](../../app/api/admin/unmasked/power-up-grant-all/route.ts)

Grants a code to every eligible team (universal codes → all teams; per-team codes → just that team). For teams with an existing `UnmaskedState`, applies the grant immediately via `buildUnmaskedGrantUpdateForPowerUp`. Teams that haven't started Unmasked yet are added to `redeemedBy` so they receive the grant on first state load (via the redeem repair path in [`/api/unmasked/redeem`](../../app/api/unmasked/redeem/route.ts)).

## What admin does NOT have its own backend for

Most admin-driven mutations go through public-namespaced routes. See [models.md](./models.md) for the full mapping. There's no `/api/admin/games`, `/api/admin/teams`, `/api/admin/game-results`, etc. — those endpoints just have no auth check today, and admin happens to be the only caller.

If the threat model tightens, add `verifyAdminRequest()` to those routes (or move the panel to call admin-namespaced versions).
