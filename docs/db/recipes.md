# db — recipes

How-to guides for the most common changes to the db layer.

## Recipe: add a new schema

1. **Decide the domain.** Will this model be owned by an existing domain or a new one?
2. **Edit [lib/db/models.ts](../../lib/db/models.ts):**
   - Add the `I…` interface near the top, alphabetically with peers.
   - Add the `Schema` definition in the middle section.
   - Add `Schema.index(...)` calls right after construction for any compound / constrained indexes.
   - Register the model at the bottom: `export const Foo: Model<IFoo> = mongoose.models.Foo || mongoose.model<IFoo>("Foo", FooSchema);`
3. **Update [models.md](./models.md)** with a new section. Field table + indexes + any subdoc shapes.
4. **Update the matching domain's `architecture.md`** to mention the new model.
5. **If the model has a schema-level enum that may evolve**, add the dev-HMR guard:
   ```ts
   if (process.env.NODE_ENV === "development" && mongoose.models.Foo) {
     delete mongoose.models.Foo;
   }
   ```

## Recipe: add a field to an existing schema

1. Add the field to the `I…` interface and the `Schema` definition.
2. Decide on a default. New fields should be optional or have a default — existing documents won't have them.
3. If the field is sensitive, set `select: false` (see `Team.passwordHash`).
4. If the field has an enum, the dev-HMR delete pattern is already in place for `UnmaskedState` and `PowerUpCode`. Other models can add it as needed.
5. Update [models.md](./models.md).
6. Decide whether legacy documents need a migration. If yes, write a `migrate-legacy-…` helper similar to [migrate-legacy-unmasked.ts](../../lib/games/unmasked/migrate-legacy-unmasked.ts) and call it from the appropriate route's GET handler.

## Recipe: add an index

1. Add `Schema.index({ …field… }, { /* opts */ })` after the schema definition.
2. If it is unique on a field that may be empty, use `partialFilterExpression: { field: { $exists: true } }` (or `$gt: ""` for strings) — not `sparse: true`. Sparse-unique misbehaves on bulk inserts of nullables.
3. New indexes are built lazily on first access in production. In development, restart `next dev` so Mongoose rebuilds. For `Team`, `dbConnect()` already calls `syncIndexes()` on first connect — see [backend.md](./backend.md).
4. If you change `Team`'s indexes, the next `dbConnect()` will migrate automatically. For other models, the migration is manual (drop the old index in Mongo, restart server) until you decide to add `.syncIndexes()` for that model in [connect.ts](../../lib/db/connect.ts).

## Recipe: rename a field

This codebase prefers **additive** renames over destructive ones — see the `verseAssembly` → `verseAssemblyIndices` example in `IUnmaskedState`:

1. Add the new field to the interface + schema.
2. Mark the old field `@deprecated` in the interface (do not remove it).
3. Add a migration in a `lib/<domain>/migrate-legacy-…` helper that copies old → new on read.
4. Update writers to set the new field. Optionally also set the old field for a release if downstream consumers haven't been updated.
5. After verifying all downstream code uses the new field, remove the old field in a follow-up commit.

## Recipe: add a model relationship (foreign key)

```ts
fooId: { type: Schema.Types.ObjectId, ref: "Foo", required: true, index: true },
```

- Always include `ref` (documents the relationship).
- Always set `index: true` if you'll query by it — this is the single-field shortcut.
- For compound queries (e.g. `{ sessionId, fooId }`), prefer a compound index instead.

## Recipe: query a model in an API route

```ts
import { dbConnect } from "@/lib/db/connect";
import { Foo } from "@/lib/db/models";

export async function GET() {
  try {
    await dbConnect();
    const foos = await Foo.find({ /* ... */ }).lean();
    return NextResponse.json(foos);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

Match the response shape used by sibling routes — see e.g. [app/api/teams/route.ts](../../app/api/teams/route.ts).

## Recipe: change MongoDB

The connection URI is `MONGODB_URI` in `.env.local`. There is no other configuration to change — `dbConnect()` reads it lazily on first call. If you switch databases (e.g. local → Atlas), restart `npm run dev` so the cached connection is dropped.
