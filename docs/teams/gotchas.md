# teams — gotchas

## 1. Public-namespaced, no auth check

`/api/teams/*` has no auth. Anyone who can reach the URL can list teams, create teams, change passwords. The middleware doesn't gate `/api/*` — see [admin/architecture.md](../admin/architecture.md).

In the casual-trust camp model, this is fine. If you ever need to harden, add `verifyAdminRequest()` to the mutation handlers (POST, PATCH, DELETE) or repoint `<TeamsClient>` to admin-namespaced versions.

## 2. Delete doesn't cascade

`DELETE /api/teams/[id]` removes the `Team` row and nothing else. Orphans:

- **`GameResult`** rows for the deleted team stay. Won't show on the leaderboard breakdown (filtered by current `Team.find`), but `getLeaderboard` does NOT exclude them — it loops over current teams and sums by team id, so orphan results silently drop out of the rollup. **Verify this when you consider the policy** — see [scoring/gotchas.md](../scoring/gotchas.md).
- **`UnmaskedState`** for the deleted team stays. `/admin/unmasked` queries by `Team.find` first, then state — orphan state never displays. But the row remains.
- **`MindgameState`** for the deleted team stays. Same.
- **`PowerUpCode.redeemedBy`** may include the deleted team id. The codes route opportunistically prunes on read.

To fix properly: extend `DELETE /api/teams/[id]` to also delete those rows. Or accept the orphan accumulation.

## 3. Bootstrap path duplicates `lib/seed`

The 6-default-team insert in `POST /api/teams { bootstrap: true }` ([teams route:39-68](../../app/api/teams/route.ts#L39-L68)) uses the same names + colors as the seed route ([seed route:51-58](../../app/api/seed/route.ts#L51-L58)). Two copies of the same default array.

If you change the colors in one, change the other. Or consolidate into a constant in `lib/seed/`.

## 4. PATCH `/api/teams` (bulk password) doesn't validate session existence

`session = new mongoose.Types.ObjectId(sessionId)`. The route doesn't check that a `Session` row with that id exists — it just `Team.updateMany({ sessionId })`. If the session doesn't exist, no teams match the filter and `modifiedCount: 0`. Caller sees `{ ok: true, updated: 0 }` and may not realize.

To fix: add `await Session.findById(sessionId)` before. Trade-off: extra DB call.

## 5. PATCH `/api/teams/[id]` doesn't validate session ownership

Anyone with a team's id can update its `name`, `color`, `loginUsername`. The session of the calling admin is irrelevant. In a multi-session world this would be a bug — for single-session camps, it's harmless.

## 6. Single-team POST returns the doc INCLUDING `passwordHash`

```ts
const doc = await Team.create({ ... });
return NextResponse.json(doc);
```

`passwordHash` isn't set on creation (defaults to undefined), so the response field is just absent. But if a future `Team.create` includes a hash by accident, the response would leak it. The PATCH handler explicitly `.select("-passwordHash")` to be safe. POST doesn't.

Defensive fix: always `await Team.findById(doc._id).select("-passwordHash")` before returning.

## 7. Bulk PATCH minimum is 3 chars

```ts
if (!password || password.length < 3) { ... 400 ... }
```

This is a guard against typos (`""` or `"a"`) — not a real password strength requirement. Camp ops can set anything 3+ chars. If you need a stronger guard, add it here.

## 8. `loginUsername` uniqueness is per-session

The partial-unique index is on `{ sessionId, loginUsername }`. So two sessions can both have a team with `loginUsername: "team1"`. Today only one active session exists, so this never collides. If multi-session arrives, the index correctly scopes — but admin UIs that show all teams would need to scope by session for clarity.

## 9. Bootstrap fails with "Teams already exist" — even one team blocks it

```ts
const existing = await Team.countDocuments({ sessionId });
if (existing > 0) return 400;
```

Inserting 5 teams manually then trying bootstrap = 400. To bootstrap, the session must have **zero** teams. Not "no Team 1 yet" — zero.

To re-bootstrap, delete all teams first (or seed from scratch). The `<TeamsClient>` UI hides the bootstrap option once teams exist.

## 10. POST without `bootstrap` flag silently creates an extra team

If you forget the `bootstrap: true` flag, `POST /api/teams` creates ONE team with the body's name/color/sortOrder. There's no "did you mean bootstrap?" hint.

The default name is `"Team"` (no number) — easy to spot, but watch for accidental empty teams.
