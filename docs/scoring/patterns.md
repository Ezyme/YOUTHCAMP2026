# scoring — patterns

## 1. Validate-then-write

Every write through `/api/game-results` validates the **whole** result set first, then writes:

```ts
const v = validatePlacementSet(entries, maxPl);
if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

// only now do we compute points and bulkWrite
```

No partial writes — either the whole submission is valid and saved, or nothing changes.

## 2. `scoringMode` dispatch

The route branches on `scoringMode`:

```ts
if (mode === "manual_points") {
  // clamp + validate per-team scores, derive placement
} else {
  // validate placement set, compute weighted points
}
```

Three of the four modes (`placement_points`, `amazing_race_finish`, `amazing_race_first_only`) share the placement branch — the mode label is informational. `amazing_race_first_only` was wired but currently unused; the seed achieves "1st only" via a `[N, 0, 0, 0, 0, 0]` row instead.

## 3. Stored points are always already-weighted

`pointsAwarded` on `GameResult` is the *post-weight* value. Reads just sum:

```ts
totalPoints = results.reduce((s, r) => s + r.pointsAwarded, 0);
```

This decouples future settings changes from past results — desirable for camp scoring (no retroactive shifts).

## 4. Plain-game-scoring shim

Mongoose subdoc internals (`_id` buffer) crash React's server-to-client serialization. Helper at [lib/admin/plain-game-scoring.ts](../../lib/admin/plain-game-scoring.ts) returns a structurally-cloned plain object. Use whenever passing `g.scoring` to a client component.

If you add a new embedded subdoc field to `GameDefinition`, write a parallel `plainXxx` helper and use it.

## 5. Client-safe types in a separate file

`comeback.types.ts` is a no-DB-imports types module. The full `comeback.ts` imports `mongoose` (transitively via `lib/db/models`) and is server-only. The types module lets `<CampDashboard>` import `ComebackAnalytics` without bundling Mongoose into the client.

If you ever extend `ComebackAnalytics`, edit `comeback.types.ts` AND `comeback.ts`.

## 6. Sort tiebreak: `sortOrder` then `name` then position

For derivations that need a deterministic order:
- Team listings: `.sort({ sortOrder: 1, name: 1 })`.
- Manual-points placement derivation: `points` desc, `sortOrder` asc.

Don't use Mongo `_id` order — it's chronological, not stable across reseeds.

## 7. Always re-fetch after write

Both `/api/game-results` and `/admin/scoring` re-fetch and return the saved rows after `bulkWrite`. Reasons:
- The bulkWrite's response shape is generic — you'd have to map back to know which rows were inserted vs updated.
- Returning the canonical state lets the client repaint without guessing.

## 8. Comeback analytics: predictable bounds

The "best possible total" and "leader pessimistic total" are the bounds the verdict text uses:

- **You** can score up to `currentPoints + sumMaxRemaining` (1st in every open game).
- **Leader** can score down to `leaderCurrent + leaderRemainingMin` (last in every open game).

If your max > leader's min → comeback "still possible".

This is mathematically conservative — leaders don't intentionally throw, so the real "still possible" line is fuzzier. The verdict copy is honest about being a best-case scenario.

## 9. Manual-points placement is for ordering

For `manual_points` games, `placement` is **not** used to compute points (that's `clampManualPoints` against the raw entry). It's stored only so the unique compound index can apply (placement is required) and so the breakdown UI can show "team is 3rd in score".

If a UI ever uses `placement` to compute manual-mode points, that's a bug — read [gotchas.md](./gotchas.md).
