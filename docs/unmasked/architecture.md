# unmasked — architecture

## Server-authoritative gameplay

Unlike Mindgame (trust-the-client), Unmasked routes mutations through the server:
- `/api/unmasked/action` — every reveal, flag, power-up use, verse-check.
- `/api/unmasked/redeem` — code redemption (grants power-ups + bonus hearts/shield).
- `/api/unmasked/state` — partial state updates (e.g. assembly drag/drop) and full board create.

This protects the gameplay invariants that matter: a player can't grant themselves extra hearts client-side, can't flip a lie to a truth, can't claim a verse without solving it.

The server *re-executes* engine functions to compute the result, then writes the new state. The client mirrors the result optimistically for snappy UX.

## Board generation (deterministic from seed)

`generateBoard(seed, gridSize, totalLies, verseFragments)` ([engine.ts:122](../../lib/games/unmasked/engine.ts#L122)) uses Mulberry32 PRNG. Same seed → same board layout — every byte. This determinism lets:
- `sortPersistedFragmentsForBoard` reorder fragments to match the seeded slot order on reload.
- "New board" reshuffles by picking a fresh seed, never by mutating the existing layout.

Lies are placed first; safe tiles get verse fragment slots assigned next. Numbers (adjacent-lie counts) are derived per-tile.

`planUnmaskedLayout` ([plan-layout.ts](../../lib/games/unmasked/plan-layout.ts)) is the higher-level orchestrator: pick verses from the pool, decide grid size, set lie count by difficulty, and (on hard+) hunt for a board with at least one tile showing clue 5+ (so the cognitive load matches "Intense" tagging).

## Verse fragments + builder row

`IDENTITY_VERSES` ([verses.ts](../../lib/games/unmasked/verses.ts)) is the canonical Scripture pool — 16 passages, each fragment-split. A board picks `verseCount` (default 4) verses, flattens them into fragments (`flattenVersesToFragments`), and seeds them onto safe tiles after lies are placed.

When a player reveals a verse tile, its fragment text + order + verseKey are exposed. To "score" a verse, the player drags fragments into the **builder row**, then submits `action: "check_verse"`. The server validates:
- Every fragment in the builder belongs to one verseKey.
- Every fragment of that verse is present.
- They're in correct `order`.

If valid → the verse is added to `versesRestored`, `verseScore` increments by fragment count. Wrong submissions add 30s to the clock penalty (`CHECK_PASSAGE_WRONG_PENALTY_SECONDS`).

`passagesComplete` flips true when every verseKey on the board is restored.

## Power-up types and lifecycle

Nine types, all in `PowerUpType` ([models.ts:78](../../lib/db/models.ts#L78)). Player-facing display names (themed) are defined in [`lib/ui/powerup-copy.ts`](../../lib/ui/powerup-copy.ts) (`POWER_UP_NAME`):

| Type | Display name | Auto-apply? | Charges/code | Behavior |
|---|---|---|---|---|
| `extra_heart` | Abundant Grace | yes | 1 | +1 max heart, +1 current heart |
| `shield` | Armor of Truth | yes | 1 | Blocks the next lie |
| `safe_opening` | Divine Blueprint | no | 1 | Reveals the largest 0-cascade tile |
| `reveal` | Glimmer of Hope | no | 5 | Random safe tile flood-reveal |
| `scout` | Prophetic Vision | no (armed) | 3 | Tap a hidden tile to peek lie/truth |
| `truth_radar` | Light of Discernment | no (armed) | 1 | Tap target + axis → reveal every truth on that row/column |
| `lie_pin` | Exposing the Dark | no (armed) | 2 | Tap anchor → flag the nearest hidden lie |
| `verse_compass` | Living Word | no (armed) | 2 | Tap anchor → reveal 2 nearest hidden verse fragments |
| `gentle_step` | Steadfast Path | no (armed) | 2 | Tap anchor → reveal only the nearest safe tile |

"Auto-apply" means the redemption flow ([`redemption-grant.ts`](../../lib/games/unmasked/redemption-grant.ts)) immediately mutates state (hearts up, shield on) and marks the inventory entry `used: true`. "Armed" means the entry sits in inventory until the player explicitly uses it.

Charge counts come from [`redeem-grants.ts`](../../lib/games/unmasked/redeem-grants.ts).

## Power-up code redemption

`PowerUpCode` rows are pre-created by admin (per-team or universal). Players type the code into the in-game UI; `/api/unmasked/redeem` validates, marks the team in `redeemedBy`, and applies the grant.

If the team already has the code in `redeemedBy` (recovery from a half-failed previous attempt) but the `UnmaskedState.redeemedCodes` array doesn't include it, the route does a "repair" pass — applies the grant once. This handles the rare case where the `redeemedBy` write succeeded but the state write failed.

`POST /api/admin/unmasked/power-up-grant-all` extends this: marks every team in `redeemedBy` and applies the grant to every team that has an existing `UnmaskedState`. Teams that haven't started Unmasked yet get the grant on first state load via the redeem repair path.

## Optimistic client + local mirror

The client ([components/games/unmasked/unmasked-board.tsx](../../components/games/unmasked/unmasked-board.tsx)) maintains a local copy of the engine state. When the player taps a tile:

1. Apply the action locally via `applyRevealLocal` / `applyFlagLocal` ([local-apply.ts](../../lib/games/unmasked/local-apply.ts)). Immediate UI update.
2. POST `/api/unmasked/action` in the background.
3. On response, reconcile: server's authoritative state replaces local state.

The local mirror in `localStorage` ([mirror.ts](../../lib/games/unmasked/mirror.ts)) survives reloads — a snapshot is written after every successful update so a refresh-mid-game restores the board in one frame instead of waiting for `/api/unmasked/state`.

Only mutable slices (revealed, flagged, hearts, status, powerUps, etc.) live in the mirror. The board layout itself is re-derived from the server's authoritative seed/gridSize/verseFragments — the mirror can never resurrect a stale board.

## Reset semantics

Two reset flavors:

- **Reset timer** (admin): zero `startedAt`, `checkPassagePenaltySeconds`, `lastPlayActivityAt`. Board, hearts, redeemed codes preserved.
- **Reset board** (admin OR self-service via `/api/unmasked/state` with `reset: true`): reshuffle minefield + verses, refresh power-up inventory from redeemed codes, **preserve the run timer** (`startedAt`), bonus hearts/shield re-applied.

Self-service "New board" is **disabled** once `passagesComplete === true` ([state route:177-181](../../app/api/unmasked/state/route.ts#L177-L181)). A finished run can't be reshuffled to game the score.

## Layer position

```
[Browser] → /play/unmasked → <UnmaskedBoard /> (client)
                                ├── local engine state
                                ├── localStorage mirror
                                └── /api/unmasked/{state,action,redeem}
                                       │
                                       ▼
                   [lib/games/unmasked/]
                     engine.ts            (pure board + power-up logic)
                     plan-layout.ts       (verse pick + grid sizing)
                     verses.ts            (IDENTITY_VERSES)
                     redeem-grants.ts     (charges per type)
                     redemption-grant.ts  (Mongo update for redeem)
                     reset-board.ts       (keep-timer reshuffle)
                     migrate-legacy-unmasked.ts (read-time normalization)
                                       │
                                       ▼
                   [lib/db/models.ts → UnmaskedState, PowerUpCode]
```
