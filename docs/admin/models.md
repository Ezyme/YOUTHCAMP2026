# admin — models

Admin reads and writes nearly every model in the system. There are **no admin-only models** — admin operates over the same shapes that camp users see, just without the per-team gate.

This file maps each admin surface to the models it touches. For field-level reference, see [db/models.md](../db/models.md).

## What admin reads

| Page / route | Models read |
|---|---|
| `/admin` (dashboard) | none directly — buttons trigger seed + reset |
| `/admin/games` | `GameDefinition` |
| `/admin/games/[id]/edit` | `GameDefinition` |
| `/admin/teams` | `Session`, `Team` |
| `/admin/scoring` | `Session`, `Team`, `GameDefinition` (via `plainGameScoring`) |
| `/admin/unmasked` | `Session`, `Team`, then via API → `UnmaskedState` |
| `/admin/power-ups` | `Session`, `Team`, then via API → `PowerUpCode` |
| `/api/admin/unmasked/state` | `UnmaskedState` (also runs legacy migration) |
| `/api/admin/unmasked/teams` | `Team`, `UnmaskedState` |

## What admin writes

| Surface | Models written |
|---|---|
| `/api/admin/login` | none — sets cookie only |
| `/api/admin/reset-camp` | Deletes `GameResult`, `MindgameState`, `UnmaskedState` for the active session; clears `redeemedBy` on `PowerUpCode` |
| `/api/admin/unmasked/reset` (action `timer`) | `UnmaskedState.startedAt`, `checkPassagePenaltySeconds`, `lastPlayActivityAt` |
| `/api/admin/unmasked/reset` (action `board`) | `UnmaskedState` (full rebuild via `resetUnmaskedBoardKeepTimer`) |
| `/api/admin/unmasked/power-up-grant-all` | `PowerUpCode.redeemedBy`, `UnmaskedState.{powerUps, redeemedCodes, hearts, …}` |
| `/api/games` (POST/PATCH/DELETE — used by admin panel, not admin-namespaced) | `GameDefinition` |
| `/api/teams` (POST/PATCH — used by admin panel) | `Team` (incl. bulk password update) |
| `/api/teams/[id]` (PATCH/DELETE — used by admin panel) | `Team` |
| `/api/game-results` (POST — used by admin panel) | `GameResult` upsert |
| `/api/unmasked/codes` (POST/PATCH/DELETE — used by admin panel) | `PowerUpCode` |
| `/api/cloudinary/upload` (POST — used by GameForm media upload) | uploads → returns `{url, publicId}` written into `GameDefinition` |

**Note the namespace inconsistency.** `/api/admin/*` is used only for spectator + reset routes. The CRUD routes the admin panel relies on (`/api/games`, `/api/teams`, `/api/game-results`, `/api/unmasked/codes`) are **public-namespaced and don't currently re-check admin auth**. Camp gate doesn't gate `/api/*` either. So those endpoints are effectively open.

In the current threat model (camp-internal use, casual trust), this is acceptable. If you need to harden, see [recipes.md](./recipes.md#recipe-enforce-admin-auth-on-a-public-namespaced-route).

## Cross-domain notes

- The seed flow (`/api/seed`) writes `GameDefinition`, `Session`, `Team`. It optionally requires `ADMIN_SECRET` (header or body) — see [seed/api.md](../seed/api.md).
- Unmasked state mutations from `/admin/unmasked` go through the unmasked engine (e.g. `resetUnmaskedBoardKeepTimer`), not raw model writes. This keeps gameplay invariants intact (timer preservation, redeemed-code replay).
- `plainGameScoring` ([lib/admin/plain-game-scoring.ts](../../lib/admin/plain-game-scoring.ts)) strips Mongoose subdoc metadata (`_id` buffers) so `GameDefinition.scoring` can be safely passed to client components without serialization errors.
