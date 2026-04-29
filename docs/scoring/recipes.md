# scoring — recipes

## Recipe: change a game's point row

1. Edit [`lib/seed/camp-games.ts`](../../lib/seed/camp-games.ts) — modify `placementPoints` for that game's row constant (`ROW_LIGHT`, `ROW_HEAVY`, etc.) or set a per-game `placementPoints`.
2. Run **Admin → Seed**. The route is upsert-by-slug, so existing definitions update.
3. **Important:** existing `GameResult` rows keep their `pointsAwarded` from the old weight × old row. To re-apply, delete the result and re-enter via `/admin/scoring`.

If you want a one-shot retro recompute, write a script that walks `GameResult.find({ sessionId, gameId })`, looks up `GameDefinition.scoring`, and re-runs `pointsForPlacement` to overwrite `pointsAwarded`. Not currently in code.

## Recipe: change a game's weight

Same as above. The `weight` field is on `GameDefinition.scoring`. Existing results don't shift; new results use the new weight.

If a game becomes weightless (`weight: 0`), it disappears from `getLeaderboard`'s sum (it doesn't actually filter — it sums `pointsAwarded` which would already be 0 for new entries) and from `getComebackAnalytics`'s weighted set.

## Recipe: add a new scoring mode

1. Update the `ScoringMode` union in [`lib/db/models.ts`](../../lib/db/models.ts):
   ```ts
   export type ScoringMode =
     | "placement_points" | "amazing_race_finish"
     | "amazing_race_first_only" | "manual_points"
     | "<new_mode>";
   ```
   Update the schema enum at [models.ts:203-208](../../lib/db/models.ts#L203-L208).
2. Add a branch in `/api/game-results/route.ts`:
   ```ts
   if (mode === "<new_mode>") { /* parse, validate, compute, upsert */ }
   ```
3. Add a corresponding `validate<NewMode>Set` and (if needed) a `pointsFor<NewMode>` helper in [`lib/scoring/points.ts`](../../lib/scoring/points.ts).
4. Update `<ScoringPanel>` to render the right form for the new mode.
5. Update `<LeaderboardBreakdown>` (`BreakdownRowDetail`) to show the right math text for the mode.
6. Update [api.md](./api.md) and [architecture.md](./architecture.md).

## Recipe: change the camp /100 rubric

The rubric lives in:
- [`lib/seed/camp-games.ts`](../../lib/seed/camp-games.ts) — weight constants `W_TEAM_MINI`, `W_COLLECT_FLAGS`, plus the `RUBRIC_100` markdown string and per-game `manualPointsMax`.
- [`app/admin/(panel)/scoring/page.tsx`](../../app/admin/(panel)/scoring/page.tsx) — header copy.
- [`app/leaderboard/page.tsx`](../../app/leaderboard/page.tsx) — header copy.

Steps:
1. Decide the new pillar weights so they sum to 100.
2. Update the weight constants in `camp-games.ts`. The team-mini-game weight is `<pillar%> / sum(top placements)` — see [seed/architecture.md](../seed/architecture.md).
3. Update each `manualPointsMax` for manual-mode games to match the new pillar caps.
4. Update the `RUBRIC_100` markdown string to reflect the new pillars.
5. Re-run **Admin → Seed**.
6. Update the header copy on `/admin/scoring` and `/leaderboard`.

## Recipe: re-apply weights to existing results

Currently no UI / route. To do it manually:

```ts
// Pseudocode (not in repo)
import { dbConnect } from "@/lib/db/connect";
import { GameDefinition, GameResult } from "@/lib/db/models";
import { pointsForPlacement } from "@/lib/scoring/points";

await dbConnect();
const games = await GameDefinition.find();
for (const g of games) {
  const results = await GameResult.find({ gameId: g._id });
  for (const r of results) {
    if (g.scoring.scoringMode === "manual_points") continue;
    const newPoints = pointsForPlacement(g.scoring, r.placement);
    if (newPoints !== r.pointsAwarded) {
      await GameResult.updateOne({ _id: r._id }, { $set: { pointsAwarded: newPoints } });
    }
  }
}
```

Run via `npx tsx <script>.ts` after putting it in a `scripts/` folder. **Coordinate with admin** — re-applying weights mid-camp will visibly shift the leaderboard.

## Recipe: add a new comeback metric

E.g. "median placement of remaining games".

1. Add the field to `ComebackAnalytics` in [`lib/scoring/comeback.types.ts`](../../lib/scoring/comeback.types.ts).
2. Compute it in `getComebackAnalytics` in [`lib/scoring/comeback.ts`](../../lib/scoring/comeback.ts).
3. Render it in `<CampDashboard>`.
4. Run typecheck — TS will catch any field gaps.

The types file is the linchpin — adding to one place but not the other surfaces a TS error immediately.

## Recipe: hide a game from the leaderboard total

Set its `weight: 0` in [`lib/seed/camp-games.ts`](../../lib/seed/camp-games.ts) and re-seed. Existing results keep their `pointsAwarded` (which was already > 0 if the game wasn't weightless before) and continue to count. New results will award 0.

To zero out existing results too:
- Manually delete: `db.gameresults.deleteMany({ gameId: <id> })`.
- Or via admin scoring page if there's a "clear" affordance (currently there isn't — but `DELETE /api/game-results` doesn't exist either).

## Recipe: add a tiebreaker to the leaderboard sort

Today: `rows.sort((a, b) => b.totalPoints - a.totalPoints)`. Tied teams are in insertion order (Team.find sort by `sortOrder, name`).

To add a real tiebreaker (e.g. count of 1st-place finishes):

1. Edit `getLeaderboard` to also count first-place finishes per team (or whatever metric).
2. Sort by `(totalPoints desc, firstPlaceCount desc, sortOrder asc)`.
3. Add the new field to `LeaderboardRow` if you want to display it.

Camp-specific decision; coordinate with the rules committee.
