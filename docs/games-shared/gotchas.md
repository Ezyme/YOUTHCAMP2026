# games-shared — gotchas

## 1. Day 0 games are invisible

`/games` filters with `g.day > 0`. `/games/[slug]` 404s when `g.day === 0`. This is intentional — Day 0 holds the merit-points reference row. If you accidentally seed a game with `day: 0` and wonder why it doesn't appear, that's why.

## 2. `/games/[slug]` notFound on missing GameResult is silent

A non-playable game without a published result for the team renders `notFound()` — same as a deleted game. There's no friendly "scored when judging is done" message on the detail page. The `/games` index page has that copy; the detail page is binary visible/hidden.

If users complain "the game disappeared", check whether their result was deleted.

## 3. Markdown is rendered as `<pre>`, not parsed

[`/games/[slug]/page.tsx:81-87`](../../app/games/[slug]/page.tsx#L81-L87):

```tsx
<pre className="whitespace-pre-wrap rounded-xl bg-muted p-4 font-sans text-foreground">
  {g.rulesMarkdown}
</pre>
```

Wrapped in Tailwind's `prose` classes for typography but not actually parsed to HTML. Markdown like `**bold**` shows literal asterisks. The seed's `rulesMarkdown` strings rely on this — they use markdown-style emphasis but render as plain text. If you ever add a real Markdown parser, regression-test the existing rules content first.

## 4. `placementPoints` length must be exactly 6 — even for `manual_points`

The schema validator requires 6 entries on `placementPoints` regardless of `scoringMode`. The `manual_points` mode doesn't actually use the placement scale for points (it ranks by score), but the field is still validated. The seed sets a default `placementPoints` for these games to satisfy the validator. Don't try to set `placementPoints: []`.

## 5. POST `/api/games` accepts arbitrary fields

The handler does `await GameDefinition.create({ name, slug, day, …, settings: body.settings ?? {}, … })` — explicit field list. If you add a field to the schema and forget to add it to the POST body construction, **creates won't include it**. PATCH uses `{ $set: body }` and is permissive. Inconsistency. Update both when adding fields.

## 6. `/api/games/[id]/DELETE` orphans `GameResult` rows

No cascade. The leaderboard's `getTeamBreakdown` filters orphans out via `gameMap.get(gameId)`, so the UI hides them. Database stays littered. To fully clean up, you'd want to also delete `GameResult.deleteMany({ gameId })`. Not currently in code.

## 7. `ensure-game-definition` only auto-creates known slugs

[`ensureGameDefinitionBySlug`](../../lib/seed/ensure-game-definition.ts) returns `false` if the slug isn't in `CAMP_GAMES`. So `/play/<random-slug>` will 404 on a fresh DB even though the page calls ensure. This is by design — only the canonical seeded games auto-create.

If you add a brand-new playable engine via the admin UI without adding it to `camp-games.ts`, `ensure` won't help and a fresh DB won't auto-bootstrap. Add to the seed list.

## 8. POST `/api/game-results` validates eagerly, then upserts in bulk

The handler validates the **entire** result set before any write. If validation fails, no rows are touched. If validation passes, `bulkWrite` is atomic per-doc but not transactional across docs — a partial failure (e.g. CastError on one teamId) could leave other rows updated. In practice the inputs come from the admin form with all-or-nothing button click, and the upsert keys are pre-validated, so this hasn't bitten anyone.

## 9. `manual_points` placement is derived from points + sortOrder tiebreak

The `placement` field on `GameResult` for `manual_points` mode is the team's rank by score, with `Team.sortOrder` as tiebreak ([game-results route:80-85](../../app/api/game-results/route.ts#L80-L85)). It exists only so the unique compound index `(sessionId, gameId, teamId)` plays nicely (placement is required, not nullable). The leaderboard breakdown UI knows to display "rank by score" — see `LeaderboardBreakdown` and [scoring/frontend.md](../scoring/frontend.md).

If two teams tie in points, the team with lower `sortOrder` gets the lower (better) placement. This is rank-stability, not "tied placement".

## 10. `mongoose.isValidObjectId` is a syntactic check

It validates the format (24 hex chars) but does not check that the object exists. So `mongoose.isValidObjectId("507f1f77bcf86cd799439011")` returns true even for an id that doesn't correspond to any document. Always combine with a `findById` to confirm existence.

## 11. PATCH `/api/games/[id]` runs validators, but POST does not

`Model.create` runs Mongoose validators by default. `findByIdAndUpdate` does NOT — unless you pass `runValidators: true`. The PATCH handler does. So both create and update will catch a `placementPoints.length !== 6`, but other validations might apply only to POST. Verify when adding new validators.

## 12. The `Playable` badge appears on `/games` only when scored

Because `/games` only shows scored games + the playable engines hide on `/games` if they're playable but lack a result… wait. Actually `/games` filters by `scoredGameIds.has(...)`. So `mindgame` and `unmasked` only appear on `/games` after they've been scored too — they don't auto-promote.

Players reach the playable engines from the home page (`/play/...` direct links), the camp dashboard, or the empty-state `/games` promotion (when no Day 1–2 game is scored). This is intentional but easy to misread when reading the code.
