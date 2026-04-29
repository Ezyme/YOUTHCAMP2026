# games-shared — recipes

## Recipe: add a new `config_only` game

Use this for any facilitator-judged event (pool game, field game, Camper's Night).

1. **Add a row to [`lib/seed/camp-games.ts`](../../lib/seed/camp-games.ts)** under `CAMP_GAMES`:
   ```ts
   {
     name: "Tug of War",
     slug: "tug-of-war",
     day: 1,
     category: "Pool games",
     engineKey: "config_only",
     isPlayable: false,
     order: 65,
     placementPoints: ROW_LIGHT, // or ROW_HEAVY
     weight: W_TEAM_MINI,        // or W_COLLECT_FLAGS or 1 etc.
     rulesMarkdown: `${RUBRIC_100}\n\n…rules…`,
   }
   ```
2. **Pick the right scoring shape:**
   - Race-style (1st–6th finish): `placementPoints` + a weight that fits the /100 rubric.
   - Manual judge scores: add `scoringMode: "manual_points"` + `manualPointsMax: <max>`.
3. **Run the Seed button in `/admin`** (or POST `/api/seed`). The route is upsert-by-slug — existing games are updated, new ones created.
4. **Verify on `/admin/scoring`** that the new row appears with the correct mode + points.
5. **Update [seed/recipes.md](../seed/recipes.md)** if you added a new scoring constant or weight.

## Recipe: hook a new engine into `/play`

Use this when adding a third (or more) playable engine.

1. **Add the new key to `EngineKey`** in [`lib/db/models.ts`](../../lib/db/models.ts):
   ```ts
   export type EngineKey = "mindgame" | "unmasked" | "config_only" | "<new>";
   ```
   And update the schema enum at [models.ts:195](../../lib/db/models.ts#L195).
2. **Update `ENGINE_LABELS`** in [`lib/games/registry.ts`](../../lib/games/registry.ts).
3. **Update `playPathForEngine`** to return `/play/<slug>` for the new engine.
4. **Build the engine module** under `lib/games/<key>/` — see [unmasked/architecture.md](../unmasked/architecture.md) for the full layering reference. Plan for: pure engine, persistence schema (in `lib/db/models.ts`), API routes, UI board.
5. **Add a state schema** to [`lib/db/models.ts`](../../lib/db/models.ts) (`<Key>State`).
6. **Add API routes** under `app/api/<key>/` (typically `state/route.ts`, possibly `action/route.ts`).
7. **Add the board component** at `components/games/<key>/`.
8. **Update the dispatch switch** in [`/play/[gameSlug]/page.tsx`](../../app/play/[gameSlug]/page.tsx) — or, if you have 4+ engines, refactor to a registry-based map.
9. **Add a domain manifest entry** in [CLAUDE.md](../../CLAUDE.md). Create `docs/<key>/` and use `/doc-domain <key>` to scaffold.

## Recipe: add an admin-editable field to `GameDefinition`

1. Add to `IGameDefinition` interface and `GameDefinitionSchema` in [`lib/db/models.ts`](../../lib/db/models.ts).
2. Add the input to [`<GameForm />`](../../components/admin/game-form.tsx).
3. The POST/PATCH at [`/api/games/route.ts`](../../app/api/games/route.ts) and [`/api/games/[id]/route.ts`](../../app/api/games/[id]/route.ts) is permissive (forwards body fields). PATCH uses `runValidators: true`. Verify the new field validates.
4. Update the seed in [`lib/seed/camp-games.ts`](../../lib/seed/camp-games.ts) if every game should have a default.
5. If the field crosses to a Client Component (e.g. via `<GameForm>`'s `initial` prop), consider adding it to `plainGameScoring` style stripping (currently only scoring needs that).
6. Update [db/models.md](../db/models.md) field table.

## Recipe: change a game's slug

⚠️ Avoid this. Bookmarks, rules markdown refs, and `ensureGameDefinitionBySlug` matches all break.

If you must:

1. `PATCH /api/games/[id]` with new slug.
2. Update [`lib/seed/camp-games.ts`](../../lib/seed/camp-games.ts) to match — otherwise the next seed run will create a duplicate.
3. Search for the old slug in markdown / code. The seed config has internal refs in `rulesMarkdown` strings.
4. If the slug is one of `mindgame` / `unmasked`, also update:
   - [`/play/[gameSlug]/page.tsx`](../../app/play/[gameSlug]/page.tsx) hardcoded references
   - [`<UnmaskedBoard>`](../../components/games/unmasked/unmasked-board.tsx) `gameSlug` default
   - All home-page links (`<Link href="/play/mindgame">`)

## Recipe: change the /games visibility rule

Currently: hide Day 0; hide Day 1–2 unless `teamHasGameResult`.

To make all Day 1–2 games visible regardless of result:
1. Edit [`/games/page.tsx`](../../app/games/page.tsx) — change `visible = games.filter(g => g.day > 0 && scoredGameIds.has(...))` to `visible = games.filter(g => g.day > 0)`.
2. Update the empty-state copy that promotes `/play/...`.
3. Update [`/games/[slug]/page.tsx`](../../app/games/[slug]/page.tsx) if you also want to drop the gate there.

This is a UX policy change — coordinate with the camp facilitators.
