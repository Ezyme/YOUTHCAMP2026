# games-shared — architecture

## Engine dispatch model

Every `GameDefinition` carries an `engineKey: "mindgame" | "unmasked" | "config_only"`. That key is the dispatch axis:

| `engineKey` | Where it renders | Server-side state |
|---|---|---|
| `"mindgame"` | `<MindgameBoard />` | `MindgameState` (per `clientKey + sessionId + teamId`) |
| `"unmasked"` | `<UnmaskedBoard />` | `UnmaskedState` (per `sessionId + teamId`) |
| `"config_only"` | (no in-app play) | none — facilitator-judged |

The `isPlayable` flag shadows this: `config_only` games are always `isPlayable: false`. The two engines are typically `isPlayable: true` for those slugs.

`config_only` is for everything that is **scored manually by facilitators** — pool games, field games, Camper's Night events, etc. They appear on the leaderboard with placement points / manual-points scoring, but `/play/<slug>` won't render a board.

## `lib/games/registry.ts`

[Source](../../lib/games/registry.ts). Two exports:

```ts
export const ENGINE_LABELS: Record<EngineKey, string> = { /* ... */ };
export function playPathForEngine(slug, engineKey): string | null {
  if (engineKey === "mindgame" || engineKey === "unmasked") return `/play/${slug}`;
  return null;
}
```

The labels appear on `/games` and `/games/[slug]`. The path helper is currently used by **none** of the SSR pages directly (they inline `${g.isPlayable ? '/play/'+slug : '/games/'+slug}`). It's a candidate to consolidate.

## URL structure

```
/games                      // SSR — list of Day 1–2 games visible to camp users
/games/[slug]               // SSR — detail page (rules, scoring) — gated for non-playable
/play/[gameSlug]            // SSR — engine board (mindgame or unmasked)
```

Plus public APIs:

```
GET    /api/games                  // list
POST   /api/games                  // create (used by admin)
GET    /api/games/[id]             // by ObjectId
PATCH  /api/games/[id]             // update
DELETE /api/games/[id]             // delete
GET    /api/games/by-slug/[slug]   // by slug

GET    /api/game-results?sessionId=...&gameId=...
POST   /api/game-results           // upsert placements / manual scores
```

None of these check auth today. They are public-namespaced and admin uses them. See [admin/architecture.md](../admin/architecture.md).

## `/games` visibility rule

`/games` deliberately hides:
- Day 0 games (merit reference row only — not a played event)
- Any Day 1–2 game that does **not** yet have a `GameResult` for this team

This is "scoreboard reveal" UX: campers don't see scoring details for events that haven't been judged yet. Playable engines (`mindgame`, `unmasked`) are always available from the home page (no gate on results).

The check happens in [app/games/page.tsx](../../app/games/page.tsx) via `loadCampTeamScoredGames` (from `lib/camp/team-game-access.ts`). See [camp-auth/backend.md](../camp-auth/backend.md).

## Layer position

```
[Browser] → /games               page
            /games/[slug]        page
            /play/[gameSlug]     page
            POST /api/games(...)
            POST /api/game-results
                 │
                 ▼
[lib/games/registry.ts]          (engine label / playable check)
[lib/scoring/points.ts]          (validation + points calc on result write)
[lib/games/mindgame, unmasked]   (engine board components, server state)
[lib/seed/ensure-game-definition.ts]  (auto-creates a missing GameDefinition for known slugs)
                 ↓
[lib/db/models.ts → GameDefinition, GameResult, MindgameState, UnmaskedState]
```

## Cross-cutting: ensure-game-definition

[`/play/[gameSlug]/page.tsx`](../../app/play/[gameSlug]/page.tsx) calls `ensureGameDefinitionBySlug(slug)` if the lookup misses. This lets a fresh database render `/play/mindgame` or `/play/unmasked` without first running the full seed — but only for slugs that exist in `CAMP_GAMES`. See [seed/backend.md](../seed/backend.md).
