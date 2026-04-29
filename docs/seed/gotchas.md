# seed — gotchas

## 1. `placementPoints: ROW_LIGHT` has 7 entries, not 6

`ROW_LIGHT = [15, 13, 11, 10, 9, 8, 7]`. The `GameDefinition.placementPoints` schema validator requires exactly 6. The seed bypasses the validator because `findOneAndUpdate` doesn't run validators by default (and the seed route doesn't pass `runValidators: true`).

The 7th entry is stored verbatim. Reads index `placementPoints[0..5]` so the extra value is never used. **But it's a latent bug** — if a future write path uses `runValidators: true` and tries to update one of these games, validation will fail with `placementPoints must have exactly 6 entries`.

To fix: trim the row to 6 in `scoringForSeed` (or in the constants themselves). Today, leave it.

## 2. Settings overwrite on full seed but not on `ensureGameDefinitionBySlug`

The full seed:
```ts
if (g.settings !== undefined) {
  $set.settings = g.settings;
}
```
sets `settings` on every run when the seed entry has them. Currently only `unmasked` has `settings` in the seed, and admins typically don't tweak Unmasked settings, so this rarely matters.

The single-slug ensure:
```ts
if (g.settings !== undefined) {
  update.$setOnInsert = { settings: g.settings };
}
```
uses `$setOnInsert` — settings are written only on initial insert. Existing settings preserved on subsequent calls.

**Asymmetry:** an admin tweaks `unmasked.settings.gridSize` from 20 to 16 → if seed runs again, it gets overwritten back to 20. If `/play/unmasked` triggers `ensureGameDefinitionBySlug` (only when missing), nothing happens. If a fresh DB sees `/play/unmasked`, ensure inserts with seed settings.

To fix: change the full seed to also use `$setOnInsert` for settings. Trade-off: settings changes in the seed file (e.g. raising difficulty) wouldn't propagate without a manual admin update or a wipe.

Not a bug — a deliberate trade-off — but worth knowing.

## 3. `Session.label` is hardcoded to "Youth Camp 2026"

[seed route:46](../../app/api/seed/route.ts#L46). Future camps need to bump this string in code. Today the label only appears on `/leaderboard` and `/camp` page headers.

When prepping for 2027:
1. Rename to `"Youth Camp 2027"` in the seed route.
2. Decide whether to keep historical sessions — running seed creates a new active session if none exists, but the **2026 session is `active: true` and won't be replaced**. You'd need to manually `Session.updateOne({label: "Youth Camp 2026"}, {$set: {active: false}})` first.
3. Re-seed to create the 2027 session.

## 4. `/api/seed` doesn't require the admin cookie

[seed route:9-15](../../app/api/seed/route.ts#L9-L15) accepts header `x-admin-secret` or body `secret`, OR no auth if `ADMIN_SECRET` is unset. The admin dashboard's `<SeedButton>` POSTs an empty body — works only when `ADMIN_SECRET` is unset.

In production with `ADMIN_SECRET` set, the dashboard's seed button **fails with 401**. Today the workaround: don't set `ADMIN_SECRET`, OR add the secret to the button's POST body, OR hit the URL with curl + header.

Consolidating onto the admin cookie would fix this. See [recipes.md](./recipes.md#recipe-lock-seed-behind-admin-login-cookie-path).

## 5. Re-seeding doesn't update existing teams' colors or names

The seed inserts 6 teams only when team count is 0. If admin renames "Team 1" to "Red Phoenix" and re-seeds, "Red Phoenix" stays. Good — admin overrides preserved.

But: if you ever want to **revert** to defaults, the seed won't help. You'd have to delete teams (`DELETE /api/teams/[id]`) and re-seed.

## 6. `setDefaultsOnInsert: true` matters for new schema fields

Adding a field to `GameDefinition` with a default and re-seeding inserts new docs (none in our case — seed only updates) with the default. Existing docs DO NOT get the default until they're written again. If you add a default value to an existing field, run a one-shot script to backfill — or accept the `undefined` until next write.

## 7. The 6-team `insertMany` runs only on first session bootstrap

```ts
const teamCount = await Team.countDocuments({ sessionId: session._id });
if (teamCount === 0) {
  await Team.insertMany([... 6 default rows ...]);
}
```

If you delete a team (down to 5) and re-seed, the seed does NOT insert a 6th. The check is `=== 0`. To re-bootstrap a session's teams, manually delete all 6 first (or use `/api/teams POST { bootstrap: true }`).

## 8. The seed route catches errors generically

```ts
} catch (e) {
  const message = e instanceof Error ? e.message : "Error";
  return NextResponse.json({ error: message }, { status: 500 });
}
```

A Mongoose validation error message ends up surfaced verbatim in the response. Acceptable for camp use; harmful in a public API where you'd reveal schema details.

## 9. The seed response doesn't include passwords

`teamLoginUsernames` is exposed; the password is referenced as "from `TEAM_SEED_PASSWORD` (default: youthcamp)" in the `teamPasswordNote` string. Plaintext password is **not** in the response — the admin needs to know it from the env or the docs.

If you ever generate per-team random passwords, you'd need to surface them once in the response (and make sure they're not logged).

## 10. `syncTeamLoginsForSession` re-hashes on every call

Even if `TEAM_SEED_PASSWORD` hasn't changed, every seed run re-hashes (with a fresh salt) and writes to all teams. Tiny waste of bcrypt cycles. Could be optimized by checking if hash already verifies the current plaintext — but the cost is ~200ms per seed call, not worth optimizing.

## 11. `ensureGameDefinitionBySlug` returns false for unknown slugs

`/play/<random-slug>` triggers `ensureGameDefinitionBySlug(slug)` which returns false (slug not in `CAMP_GAMES`). The page then 404s. **Fresh DB + new admin-created game (not in CAMP_GAMES) = 404 on `/play` until you manually run a full seed first.**

Not really a problem — admin-created games are typically `config_only` and don't need `/play`. But if you create a custom playable engine via admin, document the seed step.
