# games-shared — patterns

## 1. Engine dispatch via `engineKey` switch

The `/play/[gameSlug]` page uses a literal switch:

```tsx
{game.engineKey === "mindgame" ? (
  <MindgameBoard … />
) : game.engineKey === "unmasked" ? (
  <UnmaskedBoard … />
) : (
  <ConfigOnlyPlaceholder />
)}
```

Three branches, low arity — no need for a registry-based dispatch yet. If a fourth engine arrives, promote this to a `Record<EngineKey, ComponentType>` map in [lib/games/registry.ts](../../lib/games/registry.ts).

## 2. Settings as `Schema.Types.Mixed`

`GameDefinition.settings` is typed as `Record<string, unknown>` in the interface and `Schema.Types.Mixed` in the schema. Each engine reads what it cares about:

- Mindgame: `settings.variant` ("standard" | "quick"), `settings.goal` ("sort_desc" | …)
- Unmasked: `settings.gridSize`, `settings.difficulty`, `settings.verseCount`, `settings.versePoolKeys`, etc.

Why mixed: the per-engine settings shape differs significantly and using a discriminated union schema would multiply complexity. The cost: no schema-level validation of settings — the engine has to defensively coerce.

## 3. Day 0 = reference, not played

`day === 0` games are hidden from `/games` and 404 on `/games/[slug]`. Used for "merit points / dog tags" — a leaderboard row that's tallied offline. Don't reuse Day 0 for anything else.

## 4. `notFound()` for gating, not redirects

`/games/[slug]` returns 404 (`notFound()`) when:
- The game doesn't exist
- It's Day 0
- It's non-playable AND the team has no scored result

Why 404 instead of redirect: the game does exist as a definition, but it's invisible to this team right now. 404 is honest.

## 5. `bulkWrite` for upsert sets

When writing a *set* of results in one atomic call, use `bulkWrite([{ updateOne: { … upsert: true } }])`. The pattern in [`/api/game-results/route.ts`](../../app/api/game-results/route.ts):

```ts
const ops = entries.map((e) => ({
  updateOne: {
    filter: { sessionId, gameId, teamId },
    update: { $set: {...}, $setOnInsert: {sessionId, gameId, teamId} },
    upsert: true,
  },
}));
await GameResult.bulkWrite(ops);
```

Reuse it for any "save N rows where each is keyed by a tuple" scenario.

## 6. Re-fetch after write to return canonical state

```ts
await GameResult.bulkWrite(ops);
const saved = await GameResult.find({ sessionId, gameId }).lean();
return NextResponse.json(saved);
```

Don't try to construct the response from the input + computed values. A re-fetch is one round-trip and guarantees the client sees what's actually in the DB (including timestamps and any default fields).

## 7. `dynamic = "force-dynamic"` on every game-related page

`/games`, `/games/[slug]`, `/play/[gameSlug]` all force-dynamic. Game results change frequently and admin updates land mid-camp; static optimization would lie.

## 8. Slug as the user-facing identifier

URLs use slugs (`/games/unmasked`, `/play/mindgame`). The `_id` is for internal references (admin edit). Slugs are stable across reseed because the seed is upsert-by-slug — but you can rename a slug (`PATCH /api/games/[id]` with new `slug`) and the database lets you. **Do not rename slugs of playable games** — bookmarks and rules markdown internal refs would break. There's no migration path today.
