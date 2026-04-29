# db — rules

Hard must / must-not for the db layer.

## MUST

- **Always call `await dbConnect()` first.** Every server-side caller of any model must `await dbConnect()` before the first read/write. The function is cached and idempotent.
- **Import models from `@/lib/db/models`.** Never re-define a schema. Never construct an ad-hoc `mongoose.model(...)` outside this file.
- **Type lean results with the `I…` interfaces.** A `.lean()` call returns a plain object — annotate it (`as IGameDefinition` or via the schema generic) so downstream code stays typed.
- **Update `UNMASKED_POWER_UP_ENUM` and `PowerUpType` together.** They must stay in sync. CI / TypeScript will not catch a missing enum entry — Mongoose validation will reject inserts at runtime.
- **Use the `mongoose.models.X || mongoose.model(...)` registration pattern** for new models, so HMR doesn't double-register.
- **Index unique tuples explicitly.** When a `(sessionId, foo, bar)` tuple must be unique, declare a compound unique index on the schema (see `GameResult`, `MindgameState`, `UnmaskedState`).
- **For unique-when-set fields, use `partialFilterExpression`** — not sparse-unique. See `Team.loginUsername`.

## MUST NOT

- **Never import `mongoose` from a Client Component (`"use client"`).** The mongoose runtime ships with thousands of lines of Node-only code. Type-only imports (`import type { ... }`) are fine.
- **Never bypass `dbConnect()`** by calling `mongoose.connect()` directly. The cache lives on `globalThis.mongooseCache` and bypassing it leaks connections in dev.
- **Never store secrets in fields that are returned by default.** `Team.passwordHash` uses `select: false` for this reason. If you add another sensitive field, give it `select: false`.
- **Never delete `mongoose.models.X` outside of dev.** The conditional `if (process.env.NODE_ENV === "development")` guards in `models.ts` are required — running `delete mongoose.models.X` in production destroys the registered model and crashes the next query.
- **Never validate input only inside Mongoose.** Schema validators are a safety net, not the primary check. Validate at the API boundary first (Zod / manual checks), so users get a 400 with a clear message instead of a 500.
- **Never let a route inline business logic on a model.** `app/api/**` handlers should delegate non-trivial transforms to `lib/games/**`, `lib/scoring/**`, `lib/seed/**`, or `lib/camp/**`. The model layer should not know about gameplay rules.
