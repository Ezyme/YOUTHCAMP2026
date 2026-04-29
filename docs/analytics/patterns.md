# analytics — patterns

## 1. Wrapper-over-lib

Both routes are 20–30 lines. They:
1. Validate inputs.
2. Call into `lib/` or do a direct read.
3. Map to a flat response shape (no Mongoose internals).

Don't grow these. If logic creeps in, extract to `lib/scoring/` (analytics) or a new `lib/camp/session-info.ts` (public).

## 2. Public ≠ unauthenticated by accident

`/api/public/*` names the intent: "this route is intentionally accessible to unauthenticated callers". `/api/camp/*` doesn't carry the same guarantee — the analytics route is `/api/camp/analytics` and is also unauthenticated, but that's a tactical choice. The naming distinction makes intent visible.

If you add a new public route, put it under `/api/public/`.

## 3. Strip Mongoose internals via field-by-field copy

```ts
teams: teams.map(t => ({
  id: String(t._id),
  name: t.name,
  color: t.color,
  loginUsername: t.loginUsername ?? null,
}))
```

Manual mapping ensures only intended fields land in the response. Compare with PATCH endpoints that do `{ $set: body }` — those are permissive but require the caller to be trusted.

## 4. Null fallbacks for optional fields

```ts
loginUsername: t.loginUsername ?? null
```

Explicit null vs undefined matters for client code. JSON serializes undefined as missing; null serializes as `null`. The client's optional-chaining (`team.loginUsername?.toLowerCase()`) treats both the same, but consistency matters when typing the response.

## 5. Two-shape response from one endpoint

`/api/public/session` returns either `{ session, teams }` or `{ session: null, teams: [] }`. The "no session" branch is a 200, not a 404. Reason: empty state is a valid result for the login form (renders "no camp yet" message).

A 404 would force the caller to handle two error paths (404 vs the response).

## 6. Eager `dbConnect`

Both routes call `await dbConnect()` before any model access. Idempotent — see [db/backend.md](../db/backend.md).

## 7. Identical error shape across both routes

`{ error: <message> }` for any 4xx/5xx. Status code differentiates. The dashboard's fetch logic short-circuits on `!res.ok` and reads `data.error` for the toast — this works as long as both routes return that shape.
