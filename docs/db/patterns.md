# db — patterns

Recurring conventions in [models.ts](../../lib/db/models.ts) and the wider codebase. Follow these when adding new models.

## 1. One file, three sections

`models.ts` is split into:
1. **TypeScript interfaces & enums** (top)
2. **Schema definitions** (middle)
3. **Model registration** (bottom, using `mongoose.models.X || mongoose.model("X", schema)`)

Stay in this order — it makes diffs easier to scan.

## 2. Interface + Schema generic

```ts
export interface ITeam {
  name: string;
  color: string;
  // …
}

const TeamSchema = new Schema<ITeam>({ /* ... */ }, { timestamps: true });
```

Always pass the interface as the `Schema` generic. This catches type errors when fields drift.

## 3. Compound indexes after schema construction

```ts
const TeamSchema = new Schema<ITeam>({ /* fields */ }, { timestamps: true });

TeamSchema.index({ sessionId: 1, sortOrder: 1 });
TeamSchema.index(
  { sessionId: 1, loginUsername: 1 },
  { unique: true, partialFilterExpression: { loginUsername: { $gt: "" } } },
);
```

Single-field indexes go inline (`{ ..., index: true }`). Compound and constrained indexes go via `Schema.index()` calls right after construction.

## 4. Default factories for embedded shapes

```ts
const defaultScoring = (): GameScoring => ({
  maxPlacements: 6,
  scoringMode: "placement_points",
  placementPoints: [12, 11, 10, 9, 8, 7],
  weight: 1,
});

scoring: { type: { /* fields */ }, default: defaultScoring },
```

Use a function (not an object literal) for `default` of embedded shapes so each document gets a fresh copy.

## 5. Validators for array length / shape

```ts
placementPoints: {
  type: [Number],
  default: () => [12, 11, 10, 9, 8, 7],
  validate: {
    validator(v: number[]) { return Array.isArray(v) && v.length === 6; },
    message: "placementPoints must have exactly 6 entries",
  },
},
```

Constrain arrays at the schema level when the rest of the code assumes a fixed length.

## 6. `_id: false` for embedded subdocs

```ts
const UnmaskedPowerUpEntrySchema = new Schema(
  { type: { type: String, enum: UNMASKED_POWER_UP_ENUM }, used: { type: Boolean, default: false } },
  { _id: false },
);
```

If a subdoc array does not need its own `_id`, disable it. Saves bytes per row and avoids accidental id-based queries.

## 7. Deprecated fields stay in the schema

Older saves may still hold them. Mark them `@deprecated` in the interface, leave them in the schema (so reads parse cleanly), and write migration code in [lib/games/unmasked/migrate-legacy-unmasked.ts](../../lib/games/unmasked/migrate-legacy-unmasked.ts)-style helpers when needed.

Examples in `IUnmaskedState`: `verseKey`, `verseAssembly`, `verseCompleted`, `finalScore`.

## 8. Dev-only model reset for enum bumps

```ts
if (process.env.NODE_ENV === "development" && mongoose.models.UnmaskedState) {
  delete mongoose.models.UnmaskedState;
}
```

Place this **before** the `mongoose.model(...)` call. Required for any model whose schema references an enum that may evolve during development. See [gotchas.md](./gotchas.md).

## 9. ObjectId refs use `Schema.Types.ObjectId` + `ref`

```ts
sessionId: { type: Schema.Types.ObjectId, ref: "Session", required: true, index: true },
```

Always include `ref` even if you do not use `populate()` — it documents the relationship and lets future tooling chase references.

## 10. Reads use `.lean()` unless you need a doc

`.lean()` skips Mongoose document hydration. Default to it. Use the typed cast (`await GameDefinition.findOne(...).lean<IGameDefinition>()` or via the schema generic) so callers get plain TypeScript objects.

Drop `.lean()` only when you need `.save()`, virtual getters, or `.select("+field")` semantics.
