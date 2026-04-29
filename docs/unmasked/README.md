# unmasked — Identity Minefield + verse assembly

Minesweeper-style 20×20 board where lies are mines, truths are safe tiles, and Bible verse fragments are scattered as flippable verse tiles. Reveal everything to win the minefield, then assemble the passages on a builder row to score. Power-up codes (handed out at Amazing Race stations) grant inventory.

## What lives in this folder

- [lib/games/unmasked/engine.ts](../../lib/games/unmasked/engine.ts) — pure engine: board generation, reveal/flag, power-ups, verse-solve.
- [lib/games/unmasked/verses.ts](../../lib/games/unmasked/verses.ts) — `IDENTITY_VERSES` pool + helpers.
- [lib/games/unmasked/plan-layout.ts](../../lib/games/unmasked/plan-layout.ts) — pick verses + size the board for the run.
- [lib/games/unmasked/redeem-grants.ts](../../lib/games/unmasked/redeem-grants.ts) — per-type charge counts.
- [lib/games/unmasked/redemption-grant.ts](../../lib/games/unmasked/redemption-grant.ts) — Mongo update document for one redemption.
- [lib/games/unmasked/reset-board.ts](../../lib/games/unmasked/reset-board.ts) — keep-timer board reshuffle.
- [lib/games/unmasked/migrate-legacy-unmasked.ts](../../lib/games/unmasked/migrate-legacy-unmasked.ts) — patch old saves on read.
- [lib/games/unmasked/local-apply.ts](../../lib/games/unmasked/local-apply.ts) — client optimistic apply helpers.
- [lib/games/unmasked/mirror.ts](../../lib/games/unmasked/mirror.ts) — localStorage mirror for instant repaint.
- [lib/ui/powerup-copy.ts](../../lib/ui/powerup-copy.ts) — UI copy strings keyed by `PowerUpType`.
- [components/games/unmasked/unmasked-board.tsx](../../components/games/unmasked/unmasked-board.tsx) — `<UnmaskedBoard />` client component.
- [app/api/unmasked/state/route.ts](../../app/api/unmasked/state/route.ts), [`action/`](../../app/api/unmasked/action/route.ts), [`redeem/`](../../app/api/unmasked/redeem/route.ts), [`codes/`](../../app/api/unmasked/codes/route.ts).

## Docs in this folder

| File | What it covers |
|---|---|
| [architecture.md](./architecture.md) | Server-authoritative gameplay, board generation, verse assembly, power-up flow |
| [models.md](./models.md) | `UnmaskedState`, `PowerUpCode`, `PowerUpType` enum |
| [flows.md](./flows.md) | First-open, reveal/flag, redeem, verse-check, reset-board (mermaid) |
| [frontend.md](./frontend.md) | `<UnmaskedBoard />`, optimistic apply, local mirror, power-up rail |
| [backend.md](./backend.md) | Engine functions, plan layout, reset-board, redeem-grant builder |
| [api.md](./api.md) | All four `/api/unmasked/*` routes + admin variants |
| [rules.md](./rules.md) | Server is canonical, enum sync, verse keys are stable |
| [patterns.md](./patterns.md) | Auto-apply vs armed power-ups, partial-update Mongo idiom, deterministic seed |
| [recipes.md](./recipes.md) | Add power-up · add verse · change board size · adjust difficulty |
| [gotchas.md](./gotchas.md) | Dev HMR enum reset, deprecated fields, partial update wipes |

## Related domains

- [db](../db/README.md) — schemas live here, with the dev-HMR reset guard.
- [admin](../admin/README.md) — admin spectator + reset routes.
- [games-shared](../games-shared/README.md) — `/play/unmasked` dispatches to `<UnmaskedBoard />`.
- [camp-auth](../camp-auth/README.md) — gates the API routes.
- [seed](../seed/README.md) — `unmasked` `GameDefinition` row + settings.
