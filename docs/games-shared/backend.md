# games-shared — backend

## `lib/games/registry.ts`

[Source](../../lib/games/registry.ts). Two exports — both small, both stable.

### `ENGINE_LABELS: Record<EngineKey, string>`

```ts
{
  mindgame: "Mindgame (grid planner)",
  unmasked: "Unmasked (identity minefield)",
  config_only: "Configurable (no in-app play yet)",
}
```

Used by `/games` and `/games/[slug]` pages.

### `playPathForEngine(slug, engineKey): string | null`

Returns `"/play/<slug>"` for `mindgame` and `unmasked`; `null` for `config_only`. **Currently underused** — pages inline the same logic. If you add a third playable engine, prefer routing through this helper to keep the dispatch in one place.

## Game CRUD — `/api/games/**`

[`/api/games/route.ts`](../../app/api/games/route.ts) — list (sorted day → order) and create.
[`/api/games/[id]/route.ts`](../../app/api/games/[id]/route.ts) — by ObjectId GET / PATCH / DELETE.
[`/api/games/by-slug/[slug]/route.ts`](../../app/api/games/by-slug/[slug]/route.ts) — by slug GET.

Behavior:
- POST validates nothing manually — relies on Mongoose schema validators (in particular `placementPoints.length === 6`).
- PATCH passes `{ $set: body }` — accepts arbitrary fields. The schema's `runValidators: true` catches type errors but won't reject extra unknown fields.
- DELETE is a hard delete. There is no soft-delete or audit log.

### Auth

**None.** These routes are public-namespaced and unprotected. Admin uses them. See [admin/architecture.md](../admin/architecture.md).

## Result writing — `POST /api/game-results`

[`/api/game-results/route.ts`](../../app/api/game-results/route.ts).

Two scoring modes branch internally:

### Mode: `manual_points`

1. Read `manualPointsMax` from `GameDefinition.scoring`.
2. For each `{ teamId, points }` in body:
   - `clampManualPoints(points, max)` → 0–max, rounded to 2 decimals.
3. Validate via `validateManualPointsSet`:
   - Exactly 6 entries.
   - No duplicate `teamId`.
   - Each `points` in `[0, max]`.
4. Derive placement: rank by points desc, with `Team.sortOrder` as tiebreak.
5. Bulk upsert `GameResult` rows (one per team).

### Mode: `placement_points` / `amazing_race_finish` / `amazing_race_first_only`

1. `validatePlacementSet`:
   - Exactly `maxPlacements` (typically 6) entries.
   - Placements are exactly `1..maxPlacements` with no gaps or duplicates.
2. For each `{ teamId, placement }`:
   - `pointsForPlacement(scoring, placement) = round(placementPoints[idx] * weight)`.
3. Bulk upsert.

`amazing_race_first_only` uses the same `placement_points` math but [seed config](../../lib/seed/camp-games.ts) sets `placementPoints` like `[30, 0, 0, 0, 0, 0]` so only first place gets non-zero. (Today it's `amazing_race_finish` and a graduated row — the `first_only` mode is wired but not actively used.)

### Auth

**None.** Public-namespaced. The admin scoring panel calls it directly.

## Game read — `GET /api/games`, `/api/games/[id]`, `/api/games/by-slug/[slug]`

Public reads — no session/team scoping. Returns full `GameDefinition` documents.

## What lives in other domains

- Placement / manual-points math: [scoring/backend.md](../scoring/backend.md), [lib/scoring/points.ts](../../lib/scoring/points.ts).
- Game seed list: [seed/backend.md](../seed/backend.md), [lib/seed/camp-games.ts](../../lib/seed/camp-games.ts).
- Engine state mutations: [mindgame/backend.md](../mindgame/backend.md), [unmasked/backend.md](../unmasked/backend.md).
