# seed — models

The seed touches three models. Detailed field reference in [db/models.md](../db/models.md).

## What the seed writes

| Model | Action | Notes |
|---|---|---|
| `GameDefinition` | `findOneAndUpdate({slug}, $set, {upsert: true})` per row in `CAMP_GAMES` | Settings included only when the seed entry has them; admin tweaks preserved otherwise (subtly — see gotchas). |
| `Session` | `findOne({active: true})` then `create` if missing | Always at most one active session per camp |
| `Team` | `insertMany([6 default rows])` only when team count is 0 for the session | Existing teams not modified by the team-create step |
| `Team.loginUsername` | Set to `team1`…`teamN` only if missing | Admin-set usernames preserved |
| `Team.passwordHash` | Bcrypt of `TEAM_SEED_PASSWORD` (default `youthcamp`), refreshed on every seed run | Always overwritten — env var changes take effect on next seed |

## What the seed does NOT write

- `GameResult` — past scores stay.
- `UnmaskedState`, `MindgameState`, `PowerUpCode` — gameplay state stays.
- `Team.color`, `Team.name`, `Team.sortOrder` — only the initial 6-team `insertMany` sets these. Subsequent seeds don't touch existing teams.

## Default 6 teams

If team count is 0:

```ts
const defaultNames = ["Team 1", "Team 2", "Team 3", "Team 4", "Team 5", "Team 6"];
const colors = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#a855f7"];
// inserted with sortOrder: 0..5
```

These names + colors are duplicated in [`/api/teams/route.ts`](../../app/api/teams/route.ts) (the `bootstrap: true` path). If you change one, change both — or extract a constant.

## Default `team1`…`teamN` usernames

`syncTeamLoginsForSession` ([sync-team-logins.ts](../../lib/seed/sync-team-logins.ts)) iterates teams sorted by `sortOrder, name` and assigns `team${i+1}` to any team without a `loginUsername`. Admin-set usernames are preserved.

## CAMP_GAMES — 14 rows

| Row | Slug | Day | Category | engineKey | isPlayable |
|---|---|---|---|---|---|
| 1 | merit-points-reference | 0 | Merit | config_only | false |
| 2 | salbabida-race | 1 | Pool games | config_only | false |
| 3 | pingpong-ball-race | 1 | Pool games | config_only | false |
| 4 | water-tray-relay | 1 | Pool games | config_only | false |
| 5 | leap-of-faith | 2 | Field games | config_only | false |
| 6 | luksong-palaka | 2 | Field games | config_only | false |
| 7 | collect-the-flags | 2 | Field games | config_only | false |
| 8 | amazing-race | 2 | Amazing Race | config_only | false |
| 9 | mindgame | 2 | Amazing Race | mindgame | true |
| 10 | unmasked | 2 | Amazing Race | unmasked | true |
| 11 | campers-night-flag | 2 | Camper's Night | config_only | false |
| 12 | campers-night-cheer | 2 | Camper's Night | config_only | false |
| 13 | campers-night-presentation | 2 | Camper's Night | config_only | false |

(13 rows, not 14 — the camp metric has 13 entries.)

`order` field controls intra-day sort. `mindgame` and `unmasked` have `weight: 0` — they're playable Amazing Race stations but don't separately contribute to the leaderboard. The `amazing-race` row is the one that scores Amazing Race overall.
