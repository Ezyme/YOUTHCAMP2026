# db — gotchas

Past incidents, surprising behaviors, and "looks-buggy-but-isn't" notes for the db layer.

## 1. Dev HMR cached models reject newly added power-up types

**Symptom:** You add a new `PowerUpType` (e.g. `"verse_compass"`) to both the union and the `UNMASKED_POWER_UP_ENUM` array, restart the dev server, and the next insert into `PowerUpCode` or `UnmaskedState.powerUps` fails with `ValidationError: \`verse_compass\` is not a valid enum value`.

**Cause:** Next.js dev HMR keeps `mongoose.models.X` populated across reloads. Mongoose only validates against the schema bound at the time the model was first registered. The new enum value is in the source, but the cached schema still has the old list.

**Fix:** Already in place in [lib/db/models.ts](../../lib/db/models.ts) for `UnmaskedState` and `PowerUpCode`:

```ts
if (process.env.NODE_ENV === "development" && mongoose.models.UnmaskedState) {
  delete mongoose.models.UnmaskedState;
}
```

If you change another model's enum, copy this guard. Production (where HMR doesn't run) is unaffected.

## 2. Sparse-unique blocks bootstrapping multiple teams

**Symptom:** Earlier in development, the seed tried to `Team.insertMany([6 rows])` with `loginUsername` unset on each, and Mongo rejected the second row with `E11000 duplicate key on { sessionId, loginUsername: null }`.

**Cause:** A sparse-unique index on `{ sessionId, loginUsername }` does not skip `null` values for compound keys — Mongo treats six `(sessionId, null)` pairs as duplicates.

**Fix:** Switched to **partial** unique with `partialFilterExpression: { loginUsername: { $gt: "" } }` ([models.ts:274-280](../../lib/db/models.ts#L274-L280)). The index only enforces uniqueness when `loginUsername` is a non-empty string.

Existing deployments needed `Team.syncIndexes()` to drop the legacy sparse index and rebuild. That call is now permanent in [connect.ts:38](../../lib/db/connect.ts#L38) so any old database catches up on first connect.

## 3. `Team.passwordHash` is invisible by default

`Team.find()` does **not** return `passwordHash` — it has `select: false`. The login flow has to opt in:

```ts
const team = await Team.findOne({ sessionId, loginUsername }).select("+passwordHash");
```

If you ever wonder "where did the hash go" — that's why. See [app/api/camp/login/route.ts:54](../../app/api/camp/login/route.ts#L54).

## 4. `connection caching` survives HMR but not full process restart

`globalThis.mongooseCache` survives Next.js dev HMR (Next reuses the Node process). It does **not** survive `Ctrl-C` / `npm run dev` restart. So if you change something that requires a fresh connection (e.g. a new index, a new database), restart the dev server.

## 5. `placementPoints` must be exactly 6 entries

The schema validator on `GameDefinition.scoring.placementPoints` enforces `length === 6`:

```ts
validate: { validator(v: number[]) { return v.length === 6; } }
```

If you try to seed with 7 entries you'll get a Mongoose validation error at insert time. The seeded `ROW_LIGHT` array in [lib/seed/camp-games.ts](../../lib/seed/camp-games.ts) actually has 7 entries (`[15, 13, 11, 10, 9, 8, 7]`) — the seed code uses the first 6 implicitly via the placement scale. **Do not naively spread the 7-entry constant into `placementPoints`.** See [seed/gotchas.md](../seed/gotchas.md).

## 6. `MindgameState`'s nullable refs

`MindgameState.sessionId` and `teamId` default to `null`. The unique compound index `{ clientKey, sessionId, teamId }` therefore allows multiple "anonymous" boards as long as `clientKey` differs. If you switch these to `required`, you'll break the home-page anonymous play flow. The current routes accept both signed-in (`sessionId + teamId` present) and anonymous (`null + null`) calls.

## 7. Deprecated fields must be left in the schema

`IUnmaskedState` has `@deprecated` fields (`verseKey`, `verseAssembly`, `verseCompleted`, `finalScore`). Old saved documents still hold values there. If you remove the field from the schema, Mongoose's strict mode will silently drop the data on the next `.save()`. Removing is a multi-step ritual:

1. Migrate old documents to the new field via a `migrate-legacy-…` helper called on read.
2. Verify no live data has only the old field set.
3. Then remove from the schema.

See [migrate-legacy-unmasked.ts](../../lib/games/unmasked/migrate-legacy-unmasked.ts) for the pattern.

## 8. `Session.findOne().sort({ createdAt: -1 })` vs `Session.findOne({ active: true })`

The codebase uses two patterns for "current session":
- Most reads: `Session.findOne().sort({ createdAt: -1 })` — latest-by-creation
- The seed + `/api/admin/reset-camp`: `Session.findOne({ active: true })`

Today they return the same row because the seed only ever creates one active session. If you ever introduce multiple sessions (multi-event support), pick one pattern and update the other. The latest-by-creation approach is more defensive — `active` is just a flag, easy to forget to flip.
