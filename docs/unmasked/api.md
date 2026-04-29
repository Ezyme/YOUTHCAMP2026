# unmasked — api

All routes use `requireAuth()` (gate-cookie check unless gate is off). Camp gate semantics in [camp-auth/api.md](../camp-auth/api.md).

For admin-namespaced routes (`/api/admin/unmasked/*`), see [admin/api.md](../admin/api.md).

## `GET /api/unmasked/state`

[Source](../../app/api/unmasked/state/route.ts)

Load (or auto-create) the team's Unmasked state.

### Query
- `sessionId` (ObjectId, required)
- `teamId` (ObjectId, required)
- `slug` (default `"unmasked"`)

### Behavior
- If a state exists: run `migrateLegacyUnmaskedState`, then bump `lastPlayActivityAt`. Return.
- If not: read `GameDefinition.findOne({slug}).settings`, run `planUnmaskedLayout`, upsert a new state with default 3 hearts and `status: "playing"`. Return.

### Responses
| Status | Body |
|---|---|
| 200 | Full `IUnmaskedState` |
| 401 | `{ error: "Login required" }` |
| 400 | `{ error: "sessionId and teamId required" }` |
| 500 | `{ error }` |

---

## `POST /api/unmasked/state`

Partial update (e.g. dragging fragments) or board reset.

### Body — partial update mode

Send only the fields you want to update. Missing fields are NOT defaulted to empty:

```json
{
  "sessionId": "...", "teamId": "...",
  "verseAssemblyIndices": [42, 7, 19, 88]
}
```

Acceptable keys: `seed, gridSize, totalLies, revealed, flagged, hearts, maxHearts, verseKeys, verseFragments, verseAssemblyIndices, verseAssembly, versesRestored, verseCheckAttemptsByKey, versesGivenUp, verseScore, redeemedCodes, powerUps, shielded, status, liesHit, passagesComplete, checkPassagePenaltySeconds, finalScore, scoreBreakdown, startedAt, submittedAt, finishedAt`.

`startedAt`, `submittedAt`, `finishedAt` accept null/empty for `$unset`.

The route's `buildUnmaskedPartialUpdate` ([state route:32-87](../../app/api/unmasked/state/route.ts#L32-L87)) carefully copies only present keys. **Sending `revealed: undefined` would NOT clear it.** Sending `revealed: []` WILL clear it.

### Body — reset mode

```json
{ "sessionId": "...", "teamId": "...", "reset": true, "slug": "unmasked" }
```

Calls `resetUnmaskedBoardKeepTimer`. Refuses with 403 if `passagesComplete === true`.

### Responses
| Status | Body |
|---|---|
| 200 | Updated `IUnmaskedState` |
| 400 | `{ error: "No state fields to update" }` (empty partial) |
| 401 | `{ error: "Login required" }` |
| 403 | `{ error: "This run is complete — starting a new board is disabled." }` (reset on completed run) |
| 404 | `{ error: "State not found" }` (partial update with no doc) or `"No game to reset — open the game once first"` |
| 500 | `{ error }` |

Always bumps `lastPlayActivityAt` on success.

---

## `POST /api/unmasked/action`

Run a gameplay action through the engine.

### Body
```json
{
  "sessionId": "...", "teamId": "...",
  "action": "reveal" | "flag" | "use_powerup" | "check_verse" | "dev_reveal_all_safe",
  "index": 42,
  "powerUpType": "scout",
  "axis": "row" | "col",
  "gameSlug": "unmasked",
  "assemblyIndices": [4, 17, 22, 31, 88]
}
```

Per action:

| Action | Required fields | What it does |
|---|---|---|
| `reveal` | `index` | Mutates state via `revealTile`. Returns `result + state`. |
| `flag` | `index` | Toggles flag. Returns `{ result: { flagged: bool }, state }`. |
| `use_powerup` | `powerUpType`, varies by type | Applies via `applyPowerUp` with type-specific options. |
| `check_verse` | `assemblyIndices` | Validates via `trySolveVerseAssembly`. Updates `versesRestored` or `checkPassagePenaltySeconds`. Requires `status === "won"` (minefield clear). |
| `dev_reveal_all_safe` | none | Dev-only (NODE_ENV=development); reveals every non-lie tile. |

### Response 200 (general)
```json
{
  "result": { "type": "lie" | "number" | "verse" | "verse_check" | ..., ...details },
  "state": {
    "revealed": [...], "flagged": [...],
    "hearts": 3, "maxHearts": 3, "liesHit": 0, "shielded": false,
    "powerUps": [...], "status": "playing",
    "versesRestored": [...], "passagesComplete": false,
    "checkPassagePenaltySeconds": 0,
    "verseScore": 12,
    "verseAssemblyIndices": [...]
  }
}
```

The `state` slice is a snapshot of mutable fields after the action. The board layout (seed, gridSize, fragments) is NOT included — it doesn't change via actions.

### Errors
| Status | Body | When |
|---|---|---|
| 400 | `{ error: "Invalid ids" }` | bad ObjectIds |
| 400 | `{ error: "index required" }` | reveal/flag without index |
| 400 | `{ error: "powerUpType required" }` | use_powerup without type |
| 400 | `{ error: "Unknown action: <action>" }` | unrecognized action |
| 401 | `{ error: "Login required" }` | gate cookie missing |
| 403 | `{ error: "Not available outside development" }` | dev_reveal_all_safe in prod |
| 404 | `{ error: "No game state found" }` | no UnmaskedState doc |
| 500 | `{ error }` | DB / unexpected |

For `check_verse`, the result object includes:
- `ok: true` → `verseKey`
- `ok: false` → `reason: string`, optional `referenceClue` (e.g. "Psalm 139:14"), `penaltySecondsAdded: 30 | 0`

---

## `POST /api/unmasked/redeem`

Redeem a power-up code.

### Body
```json
{ "sessionId": "...", "teamId": "...", "code": "ABC123" }
```

Code is uppercased server-side.

### Responses
| Status | Body |
|---|---|
| 200 | `{ ok: true, powerUpType, applied: bool, repaired?: true }` |
| 400 | `{ error: "Invalid input" }` (missing/bad ids) or `"Code already redeemed"` |
| 401 | `{ error: "Login required" }` |
| 403 | `{ error: "This code is not for your team" }` (per-team mismatch) |
| 404 | `{ error: "Invalid code" }` |
| 500 | `{ error }` |

### Side effects
- `PowerUpCode.$addToSet redeemedBy` (with rollback on UnmaskedState update failure).
- `UnmaskedState`: `$addToSet redeemedCodes`, `$push powerUps {type, used: false}` × charges, plus auto-apply `$inc` / `$set` for `extra_heart` / `shield`.

`applied: true` indicates an auto-apply type. The "repaired" flag returns true when the code was already in `redeemedBy` but the state didn't have it — a recovery for half-failed prior attempts.

---

## `GET /api/unmasked/codes?sessionId=...`

[Source](../../app/api/unmasked/codes/route.ts)

List codes for a session, enriched with team names.

### Auth: public (no admin check today; admin panel calls it).
### Response 200: array of `IPowerUpCode` augmented with `teamName`, `redeemedByNames`. The route opportunistically prunes orphaned `redeemedBy` ids (teams that no longer exist) on read.

---

## `POST /api/unmasked/codes`

Create a `PowerUpCode`. Used by `<PowerUpsAdmin>`.

### Body
```json
{ "sessionId": "...", "code": "ABC123", "powerUpType": "extra_heart", "scope": "universal" | "per_team", "teamId": "<id>?" }
```

### Responses
| Status | Body |
|---|---|
| 200 | created doc |
| 400 | `{ error: "Code already exists for this session" }` (E11000) or `"Invalid sessionId"` / `"Code required"` |
| 404 | `{ error: "Session not found" }` |
| 500 | `{ error }` |

---

## `PATCH /api/unmasked/codes`

Update an existing `PowerUpCode`. Body `{ id, ...fields }`. If `code` changes, the route also updates every `UnmaskedState.redeemedCodes` entry from old → new (preserves continuity).

---

## `DELETE /api/unmasked/codes?id=...`

Hard-delete one code row. Doesn't cascade to `UnmaskedState.redeemedCodes` — old codes linger as harmless strings.
