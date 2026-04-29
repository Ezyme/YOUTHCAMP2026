# games-shared — frontend

## Pages

### `/games` — [app/games/page.tsx](../../app/games/page.tsx)

Server. `dynamic = "force-dynamic"`. Calls `loadCampTeamScoredGames()`. If no session → show "run seed from Admin" message. If team has no scored Day 1–2 games → show a promo card with `/play/unmasked` + `/play/mindgame`. Otherwise render Day 1 and Day 2 sections, listing only games the team has been scored on.

Each card shows: name, category badge, `Playable` badge if `isPlayable`, engine label (`ENGINE_LABELS[engineKey]`), and a quick scoring hint:
- `manual_points` → `"Manual per team (max N toward /100)"`
- `amazing_race_first_only` → `"1st place only → 30 pts max"`
- `amazing_race_finish` → `"Finish order → points"`
- `weight === 0` → `"Not in app total (reference)"`
- otherwise → `"Points 12 / 11 / 10 / 9 / 8 / 7"` etc.

The link target is `g.isPlayable ? "/play/<slug>" : "/games/<slug>"`.

### `/games/[slug]` — [app/games/[slug]/page.tsx](../../app/games/[slug]/page.tsx)

Server. `dynamic = "force-dynamic"`. 404s on:
- Missing `GameDefinition`
- Day 0 (merit reference)
- `!isPlayable && !teamHasGameResult` (scoreboard-reveal gate)

Renders rules markdown + scoring summary + Play button (or "coming soon" placeholder).

Game rules are stored in the `rulesMarkdown` model field as Markdown. The dedicated rules page at [`app/games/[slug]/page.tsx`](../../app/games/[slug]/page.tsx) renders it via `react-markdown` + `remark-gfm`, wrapped in an `<article className="prose prose-zinc ... dark:prose-invert">` (the card classes — `rounded-xl bg-muted p-4` — sit on the `<article>`, no inner `<pre>`). The play-page teaser at [`app/play/[gameSlug]/page.tsx`](../../app/play/[gameSlug]/page.tsx) slices the first 200 chars and renders as plain text — markdown syntax shows literally there (acceptable for the teaser).

The `prose` utilities are powered by the Tailwind typography plugin loaded in [globals.css](../../app/globals.css) (`@plugin "@tailwindcss/typography";`).

### `/play/[gameSlug]` — [app/play/[gameSlug]/page.tsx](../../app/play/[gameSlug]/page.tsx)

Server. `dynamic = "force-dynamic"`.

Steps:
1. `dbConnect`.
2. Find `GameDefinition` by slug; if missing, call `ensureGameDefinitionBySlug` and retry.
3. Find latest `Session`.
4. Resolve team id from `?teamId=` query param, then fall back to `youthcamp_team_id` cookie.
5. If no team id → redirect to `/login?next=/play/<slug>`.
6. Find the team for label / name.
7. Dispatch on `engineKey`:
   - `mindgame` → `<MindgameBoard sessionId teamId groupLabel />`
   - `unmasked` → `<UnmaskedBoard sessionId teamId gameSlug groupLabel />`
   - `config_only` → "not playable in-app yet" placeholder

The board components handle their own state fetching (`/api/mindgame/state`, `/api/unmasked/state`).

## What this domain does NOT own

- `<MindgameBoard />` lives under [components/games/mindgame/](../../components/games/mindgame/). See [mindgame/frontend.md](../mindgame/frontend.md).
- `<UnmaskedBoard />` lives under [components/games/unmasked/](../../components/games/unmasked/). See [unmasked/frontend.md](../unmasked/frontend.md).
- The admin game form lives under `components/admin/`. See [admin/frontend.md](../admin/frontend.md).

## Toasts and theme

Inherited from [shared-ui](../shared-ui/README.md). Pages don't add their own toasts/themes.
