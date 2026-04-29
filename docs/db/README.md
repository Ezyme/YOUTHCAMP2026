# db — Mongoose models & connection

The persistence layer for the entire app. Every other domain reads/writes through models defined here.

## What lives in this folder

- [models.ts](../../lib/db/models.ts) — All 7 Mongoose schemas + `PowerUpType` union.
- [connect.ts](../../lib/db/connect.ts) — `dbConnect()` cached connection helper.

## Docs in this folder

| File | What it covers |
|---|---|
| [architecture.md](./architecture.md) | How the db layer is structured, who reads/writes which models, dev-HMR cache reset trick |
| [models.md](./models.md) | Per-schema field reference (the heart of this folder) |
| [backend.md](./backend.md) | `dbConnect()` semantics + `Team.syncIndexes()` |
| [api.md](./api.md) | _N/A — db has no direct API surface_ |
| [frontend.md](./frontend.md) | _N/A — `mongoose` is server-only_ |
| [rules.md](./rules.md) | Hard must / must-not (server-only imports, single dbConnect, partial unique index for Team) |
| [patterns.md](./patterns.md) | Schema authoring conventions, model registration pattern |
| [recipes.md](./recipes.md) | How to add a new schema · add a field · add an index · rename a field |
| [env.md](./env.md) | `MONGODB_URI` (only env var this domain reads) |
| [gotchas.md](./gotchas.md) | Dev HMR cached models, sparse-vs-partial index incident, deprecated fields |

## Ownership

This folder is the **single source of truth** for schemas. Do not redefine model shapes elsewhere — import them.

## Related domains

- All — every domain that touches a model depends on `db`.
- [seed](../seed/README.md) — bootstraps `Session` / `Team` / `GameDefinition` rows.
- [scoring](../scoring/README.md) — heaviest reader of `GameResult` + `GameDefinition`.
- [unmasked](../unmasked/README.md), [mindgame](../mindgame/README.md) — own gameplay state schemas.
