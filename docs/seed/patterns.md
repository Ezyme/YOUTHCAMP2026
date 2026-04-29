# seed — patterns

## 1. `findOneAndUpdate({slug}, $set, {upsert: true})` per row

Idempotent. New games get inserted; existing games get their fields refreshed. Slug is the stable identifier. The `setDefaultsOnInsert: true` option ensures schema defaults apply on the initial insert.

## 2. Conditional `$set` for protected fields

```ts
const $set = { name, slug, day, category, ... };
if (g.settings !== undefined) {
  $set.settings = g.settings;
}
```

`settings` is treated as protected — only overwritten when the seed explicitly provides it. Currently only `unmasked` has settings in the seed.

`ensureGameDefinitionBySlug` goes further with `$setOnInsert: { settings: g.settings }` — the single-game ensure NEVER overwrites existing settings, even if the seed entry has them.

This is intentional: admin tweaks via `<GameForm>` should survive seed runs.

## 3. `manualPointsMax` only when defined

```ts
if (g.manualPointsMax != null) {
  return { ...base, manualPointsMax };
}
return base;
```

Don't write `manualPointsMax: undefined` — Mongoose stores it as a literal undefined which is wasteful.

## 4. Single bcrypt hash for batch updates

`syncTeamLoginsForSession` hashes the password ONCE then writes to all teams. Bcrypt is expensive; batch saves ~1000ms on a 6-team write.

## 5. Default-then-override for usernames

```ts
const loginUsername = existing || `team${i}`;
```

Existing wins. Only assign default when the field is empty/whitespace.

## 6. Stable column constants for the /100 rubric

`W_TEAM_MINI = 25/120` and `W_COLLECT_FLAGS = 50/120` are derived from the rubric pillars and the placement-row sums. They're written as fractions (not pre-computed decimals) so the relationship to the rubric is visible.

If you change the rubric, change the numerators. If you change the placement rows, change the denominator.

## 7. The seed payload is a TypeScript file, not JSON

`CAMP_GAMES` is a `const` array in TS. Why not JSON?
- Code lets you build constants like `RUBRIC_100`, `ROW_LIGHT`, etc. and reference them.
- TypeScript validates the shape (`SeedGame[]`) at compile time.
- Comments and computed values (template strings, weight fractions) are natural.

A JSON config would lose those. The trade-off: editing the seed requires a code deploy, not a data update. That's fine — the camp's game list is stable across years.

## 8. `setDefaultsOnInsert: true`

Important for new fields. When you add a field to `GameDefinition` schema with a default, existing docs don't auto-fill — they keep `undefined`. New docs (via the seed's `findOneAndUpdate`) DO get defaults thanks to this flag.

If you skip `setDefaultsOnInsert`, a brand-new game inserted by seed could lack defaults that the schema specifies. Don't omit it.

## 9. Team bootstrap inline (not via syncTeamLoginsForSession)

Names, colors, sortOrder are inline in the seed route ([seed route:51-58](../../app/api/seed/route.ts#L51-L58)). They're duplicated in [`/api/teams/route.ts`'s bootstrap path](../../app/api/teams/route.ts) ([teams route:39-45](../../app/api/teams/route.ts#L39-L45)).

Could be DRYed. Today the duplication is small enough not to matter — but if you ever change the default colors, change both places.

## 10. `rulesMarkdown` is rendered as actual Markdown

`rulesMarkdown` is rendered as actual Markdown on the rules page (`app/games/[slug]/page.tsx` uses `react-markdown` + `remark-gfm`). Use `**bold**`, headings, and `-` lists freely — they will render as formatted HTML, not raw text. Keep rules short and structured: see the `unmasked` entry in [camp-games.ts](../../lib/seed/camp-games.ts) for an example with a title, mechanics paragraph, an action list, and a code-unlock note in four short blocks.

## 11. `RUBRIC_100` markdown string

```ts
const RUBRIC_100 =
  "**Camp total = /100:** Merit **5%** · Pool + field team games **25%** combined · Amazing Race **30%** · Flag **10%** · Cheer **10%** · Group skit **20%**.";
```

This appears in every game's `rulesMarkdown` (template-literal interpolation: `${RUBRIC_100}\n\n…game-specific…`). Players see it on the game detail page. Change the string and re-seed to update everywhere.

The leaderboard page header has a similar copy that's NOT pulled from this constant — it's hand-written. If you change the rubric, update both places.
