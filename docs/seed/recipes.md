# seed — recipes

## Recipe: add a new game to the camp

1. **Add a row to `CAMP_GAMES`** in [`lib/seed/camp-games.ts`](../../lib/seed/camp-games.ts):
   ```ts
   {
     name: "New Event",
     slug: "new-event",
     day: 1,                        // 0 (reference) | 1 | 2
     category: "Pool games",        // free-form
     engineKey: "config_only",      // or "mindgame" / "unmasked"
     isPlayable: false,             // true only for the two playable engines
     order: 65,                     // intra-day sort
     placementPoints: ROW_LIGHT,    // or ROW_HEAVY, AMAZING_RACE_POINTS, defaultPoints
     weight: W_TEAM_MINI,           // or W_COLLECT_FLAGS, 1, 0
     scoringMode: "placement_points", // or "manual_points" / "amazing_race_finish"
     manualPointsMax: 5,            // only for manual_points
     rulesMarkdown: `${RUBRIC_100}\n\n…rules…`,
   }
   ```
2. Pick a unique `slug` and a sensible `order` to slot it into the day's listing.
3. Run **Admin → Seed**. Existing games refresh; the new one is inserted.
4. Verify on `/admin/games` that it appears with the right scoring config.
5. **Update the rubric weights** if this addition shifts the /100 math. (E.g. adding a 7th team mini-game means recomputing `W_TEAM_MINI`.)

## Recipe: change the camp password

```dotenv
TEAM_SEED_PASSWORD=newpassword
```

Then **Admin → Seed**. Every team's `passwordHash` is rebcrypted with the new value. Existing usernames preserved.

For per-deployment override (production has a different password than staging), set `TEAM_SEED_PASSWORD` in the platform's secret store and redeploy.

## Recipe: rotate the admin secret + camp password together

```dotenv
ADMIN_SECRET=<new-long-random>
TEAM_SEED_PASSWORD=<new-camp-password>
```

Restart server. Re-login at `/admin/login`. Run **Admin → Seed** to refresh team passwords. Hand out the new camp password.

## Recipe: change a team's color or name without re-seeding

Use `/admin/teams` UI (calls `/api/teams/[id]` PATCH). The seed only touches new teams in zero-team sessions, so it won't overwrite. If you add this AFTER seed has run, the team list keeps your changes.

## Recipe: rename a default team's `loginUsername`

`/admin/teams` UI sets `loginUsername` per team. The seed's `syncTeamLoginsForSession` only assigns a default when the field is missing. Once you set a custom value (e.g. `red-team`), seed leaves it alone.

## Recipe: reset all play state without re-seeding

Use **Admin → Reset camp** (`<ResetCampButton>` calls `/api/admin/reset-camp`). Wipes:
- `GameResult` for the active session
- `MindgameState` for the active session
- `UnmaskedState` for the active session
- `PowerUpCode.redeemedBy` cleared (codes themselves preserved)

Definitions, sessions, teams, login credentials remain.

## Recipe: full clean-slate (drop everything)

```bash
mongo
> use youthcamp
> db.dropDatabase()
```

Then **Admin → Seed** to bootstrap from scratch. (Without re-seeding, the app behaves as if no camp has ever run.)

## Recipe: change the camp /100 rubric

See [scoring/recipes.md](../scoring/recipes.md#recipe-change-the-camp-100-rubric). The seed file owns the rubric constants (`W_TEAM_MINI`, `W_COLLECT_FLAGS`, `RUBRIC_100`, `manualPointsMax` per game).

## Recipe: rename a game

⚠️ Avoid renaming `slug`. Bookmarks, rules markdown internal refs, and `ensureGameDefinitionBySlug` would all need updating.

If you must rename `name` only:
1. Edit the row in `CAMP_GAMES`.
2. Re-seed.
3. The leaderboard breakdown picks up the new name on next refresh.

## Recipe: add per-team unique passwords

Currently all teams share `TEAM_SEED_PASSWORD`. To make them unique:

1. Change `syncTeamLoginsForSession` to generate a unique random password per team (e.g. `passwordRandom = crypto.randomBytes(8).toString('hex')`) and bcrypt each.
2. Return the plaintext usernames + passwords in the seed response.
3. Update `<SeedButton>` to display the per-team passwords (not just usernames) — admin must hand them out individually.
4. Update [camp-auth/env.md](../camp-auth/env.md) — `TEAM_SEED_PASSWORD` becomes vestigial.

This is a privacy / security boundary change. Coordinate with camp staff.

## Recipe: lock seed behind admin login (cookie path)

Currently `/api/seed` accepts a header or body secret, but doesn't check the admin cookie. To require a logged-in admin:

1. Add `import { verifyAdminRequest } from "@/lib/admin-auth";`
2. Replace the inline `header/body secret` check with `if (!(await verifyAdminRequest())) return 403`.
3. The admin dashboard's `<SeedButton>` already includes the cookie automatically — no client change needed.
4. External tools (curl) will need to acquire the cookie via `/api/admin/login` first, or you keep the header path for backward compat.

This consolidates admin auth onto the cookie. Today's dual-channel (header OR body OR nothing) is legacy.
