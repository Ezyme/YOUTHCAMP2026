# db — backend

## `dbConnect()` — [lib/db/connect.ts](../../lib/db/connect.ts)

Single helper that every server-side caller uses to obtain the live Mongoose connection.

```ts
import { dbConnect } from "@/lib/db/connect";

await dbConnect();
const teams = await Team.find({ sessionId });
```

### Behavior

1. Reads `MONGODB_URI` from `process.env`. Throws if unset, with a friendly hint to add it to `.env.local`.
2. Caches the connection on `globalThis.mongooseCache` so the same instance is reused across:
   - Multiple route handler invocations
   - Multiple page renders
   - Next.js dev HMR reloads
3. On the **first** successful connect, runs `Team.syncIndexes()` ([connect.ts:38](../../lib/db/connect.ts#L38)). Errors are logged via `console.warn` but do not throw — the connection still resolves.
4. Returns the cached `mongoose` instance.

### Why `Team.syncIndexes()`?

The `Team` schema's login uniqueness migrated from sparse-unique to **partial** unique mid-development. `syncIndexes()` drops index variants that no longer match the schema and rebuilds them. See [models.md](./models.md#team) and [gotchas.md](./gotchas.md).

This is currently the **only** model with auto-sync. Other models use the manual `schema.index({ ... })` calls that Mongoose builds lazily on first access. If you change another model's index, decide whether you need to add it here — typically you do not, because `mongoose.connect()` will create it on demand.

### Calling repeatedly is safe

`dbConnect()` is idempotent — call it at the top of every API handler / page that touches a model. The cache short-circuits all but the first call.

### Failure modes

- `MONGODB_URI` unset → throws `Error("Please define MONGODB_URI in .env.local …")`
- Network failure → `mongoose.connect()` rejection bubbles up to the caller
- `Team.syncIndexes()` failure → logged, swallowed (the cache still resolves)

Caller routes consistently wrap dbConnect in `try { } catch (e) { return NextResponse.json({ error }, { status: 500 }) }`. See [scoring/api.md](../scoring/api.md), [unmasked/api.md](../unmasked/api.md), etc.

---

## Models module — [lib/db/models.ts](../../lib/db/models.ts)

Imports of the form `import { Team, Session } from "@/lib/db/models"` give you the registered models. Re-importing across modules returns the same singleton because Mongoose registers models on its global registry (`mongoose.models`).

The file also exports:
- TypeScript interfaces (`ITeam`, `IGameDefinition`, `IUnmaskedState`, …) for typing `.lean()` query results
- `UNMASKED_POWER_UP_ENUM` — used by `PowerUpCode` and `UnmaskedState` as the source of truth for the power-up enum

### Lean reads

Most reads use `.lean()` so you receive plain objects, not Mongoose documents. Type these via the matching `I…` interface:

```ts
const game = await GameDefinition.findOne({ slug }).lean();
// `game` is typed as `IGameDefinition & { _id: ... } | null`
```

A few writes (e.g. `Team.find().select("+passwordHash")` in `app/api/camp/login/route.ts`) need full Mongoose documents to call `.save()` or to use `.select("+field")` — keep `.lean()` off when you need that.

### `select: false` fields

`Team.passwordHash` has `select: false`. Reads do not include it unless you opt in with `.select("+passwordHash")`. This is the only such field in the project.
