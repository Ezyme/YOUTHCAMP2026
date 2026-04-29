# teams — patterns

## 1. Bulk-PATCH for shared password

`PATCH /api/teams { sessionId, password }` updates every team in the session in one call. Single bcrypt hash, `Team.updateMany`.

Why bulk: the camp uses a single shared password for all teams. Per-team password rotation isn't a workflow — bulk is.

If/when per-team unique passwords arrive, this endpoint changes to per-team. See [seed/recipes.md](../seed/recipes.md#recipe-add-per-team-unique-passwords).

## 2. Bootstrap-via-flag for the 6-team initial insert

```ts
if (body.bootstrap) { /* insert 6 default rows */ }
```

Body shape disambiguates "create one team" from "create six default teams". A separate route would have been cleaner; the flag-on-body pattern works because there are exactly two write modes.

## 3. Lowercase usernames at the boundary AND in the schema

The schema sets `lowercase: true, trim: true` on `loginUsername`. The API also explicitly lowercases via `.toLowerCase()`. Belt-and-suspenders:
- Schema lowercase fires on `save()` and `findOneAndUpdate` — but only when the field is in the update.
- Explicit lowercase ensures the value is right even if some path bypasses Mongoose middleware.

If you ever switch Mongo drivers or use raw `updateOne` with case-sensitive comparisons, the explicit lowercase saves you.

## 4. List responses always exclude `passwordHash`

```ts
await Team.find({ sessionId }).select("-passwordHash")...
```

Required because the schema has `select: false` BUT explicit `.select(...)` chains override defaults. The exclude is defensive.

## 5. PATCH supports partial updates with explicit field allowlist

```ts
const updates = {};
if (body.name != null) updates.name = String(body.name);
if (body.color != null) updates.color = String(body.color);
if (body.loginUsername != null) updates.loginUsername = ...;
```

Allow-list only. Sending `{ passwordHash: "new" }` is silently ignored. The route doesn't validate by Zod — manual checks suffice for 3 fields.

If we add a 4th editable field, extend the allow-list. Don't switch to `$set: body`.

## 6. POST for create — no PUT

There's no `PUT /api/teams/[id]` for replace-semantic creation. Creates always use POST without an id. The compound-unique index would catch any duplicate username; the partial filter ensures null usernames don't conflict.

## 7. `Team.find().sort({ sortOrder: 1, name: 1 })` everywhere

The two-field sort is duplicated across many handlers. If we ever change the canonical team order (e.g. by color), update everywhere. Some places use `{ sortOrder: 1 }` only — close enough since `sortOrder` is unique by convention.

## 8. Delete is hard delete, no soft delete

Mongoose doesn't have a `deletedAt` field. `Team.deleteOne` removes the row. To soft-delete, you'd add `deletedAt?: Date` to the schema, change all queries to filter `{ deletedAt: { $exists: false } }`, and change `DELETE /api/teams/[id]` to set `deletedAt`.

Camp use doesn't really benefit from soft-delete; a deleted team is a real "remove this team from the camp" action. Don't add complexity unless needed.
