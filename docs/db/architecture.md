# db — architecture

## Layer position

```
app/api/**            → calls dbConnect() then reads/writes Models
lib/games/**          → server-only modules that update gameplay state
lib/scoring/**        → aggregates GameResult / GameDefinition
lib/seed/**           → bootstraps GameDefinition + Team
lib/camp/**           → reads Team / Session for cookie-bound team identity
        ↓
lib/db/models.ts      ← single file, all schemas
lib/db/connect.ts     ← cached connection
        ↓
MongoDB (URI from MONGODB_URI)
```

The dependency direction is **strictly inward**: `app/` → `lib/games | lib/scoring | lib/camp | lib/admin` → `lib/db`. `lib/db/**` itself does not import from any other `lib/` folder.

## Single-file schema strategy

All Mongoose schemas live in [lib/db/models.ts](../../lib/db/models.ts). The file has three sections:

1. **TypeScript interfaces** — `IGameDefinition`, `ISession`, `ITeam`, `IMindgameState`, `IGameResult`, `IUnmaskedState`, `IPowerUpCode`, `IEvent`. The `PowerUpType` union and `UNMASKED_POWER_UP_ENUM` array also live here.
2. **`Schema` definitions** — one per model, with inline indexes.
3. **Model registration** — uses the `mongoose.models.X || mongoose.model("X", schema)` idiom so HMR doesn't re-register.

Why one file? With ~7 models the cross-references (e.g. `GameResult` references `GameDefinition` + `Team` + `Session`) are easier to scan in one place than across 7 files. Splitting becomes worthwhile around 15+ models.

## Connection caching

[connect.ts](../../lib/db/connect.ts) stores the live `mongoose` connection on `globalThis.mongooseCache` so that every API route, page, and lib function receives the same instance. The cache survives Next.js dev HMR. See [backend.md](./backend.md) for full semantics.

## Dev-HMR enum poisoning workaround

Two models — `UnmaskedState` and `PowerUpCode` — explicitly delete their cached entry from `mongoose.models` in development before re-registering ([models.ts:472](../../lib/db/models.ts#L472), [models.ts:482](../../lib/db/models.ts#L482)). This is because both reference the `UNMASKED_POWER_UP_ENUM` list, and adding a new power-up while the dev server is running otherwise validates against the old enum and rejects valid documents.

If you ever change another model's enum mid-edit, follow the same pattern. See [gotchas.md](./gotchas.md).

## Index management on connect

`dbConnect()` calls `Team.syncIndexes()` on the **first** connect of the process ([connect.ts:38](../../lib/db/connect.ts#L38)). This drops legacy index variants and rebuilds them from the schema. Currently only `Team` does this, because the team login index migrated from sparse-unique to partial-unique mid-development.

## Model relationships

```
Session ──┬── Team ──── (sessionId ref)
          │
          ├── GameDefinition ── (no session ref — global definitions)
          │
          ├── GameResult ── (sessionId + gameId + teamId)
          │
          ├── MindgameState ── (clientKey + sessionId + teamId)
          │
          ├── UnmaskedState ── (sessionId + teamId)
          │
          └── PowerUpCode ── (sessionId, optional teamId, redeemedBy[teamId])

Event ── (sessions reference event via eventId — currently unused in routes)
```

Most queries scope by `sessionId`. Game definitions are global (one canonical Day 0–2 list shared across sessions).

See [models.md](./models.md) for field-level details.
