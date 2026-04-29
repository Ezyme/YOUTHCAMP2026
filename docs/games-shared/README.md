# games-shared — Engine registry, generic play & game APIs

The shared seam between the two playable engines (`mindgame`, `unmasked`) and everything that's just config (`config_only`). Owns the engine registry, public game CRUD, and `/games` + `/play` SSR pages.

## What lives in this folder

- [lib/games/registry.ts](../../lib/games/registry.ts) — `ENGINE_LABELS`, `playPathForEngine()`.
- [app/api/games/route.ts](../../app/api/games/route.ts), [`[id]/`](../../app/api/games/[id]/route.ts), [`by-slug/[slug]/`](../../app/api/games/by-slug/[slug]/route.ts) — game CRUD.
- [app/api/game-results/route.ts](../../app/api/game-results/route.ts) — placement / manual-points entry.
- [app/games/page.tsx](../../app/games/page.tsx), [`[slug]/`](../../app/games/[slug]/page.tsx) — public-facing list and detail.
- [app/play/[gameSlug]/page.tsx](../../app/play/[gameSlug]/page.tsx) — engine-dispatching play page.

## Docs in this folder

| File | What it covers |
|---|---|
| [architecture.md](./architecture.md) | Engine dispatch model, the `EngineKey` enum, how `/play/[slug]` selects a board |
| [flows.md](./flows.md) | Game listing flow (visibility-after-scored), play page flow |
| [frontend.md](./frontend.md) | `/games`, `/games/[slug]`, `/play/[gameSlug]` |
| [backend.md](./backend.md) | `lib/games/registry.ts`, scoring delegation patterns |
| [api.md](./api.md) | Every public game/result route |
| [rules.md](./rules.md) | Slug uniqueness, isPlayable contract, `/games` visibility-after-score |
| [patterns.md](./patterns.md) | Engine dispatch via switch, settings-as-mixed |
| [recipes.md](./recipes.md) | Add a `config_only` game, hook a new engine into `/play` |
| [gotchas.md](./gotchas.md) | Day-0 hidden, `/games/[slug]` gates non-playable behind a result, mongoose isValidObjectId |

## Related domains

- [mindgame](../mindgame/README.md) and [unmasked](../unmasked/README.md) — the two real engines.
- [scoring](../scoring/README.md) — `/api/game-results` writes here, but rule logic lives in `lib/scoring`.
- [seed](../seed/README.md) — initial `GameDefinition` rows come from `lib/seed/camp-games.ts`.
- [admin](../admin/README.md) — `/admin/games` mutates these via the public-namespaced routes.
- [db](../db/README.md) — `GameDefinition` and `GameResult` live in `lib/db/models.ts`.
