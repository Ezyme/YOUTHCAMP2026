# unmasked — flows

## First-open flow (no save yet)

```mermaid
sequenceDiagram
  actor User
  participant Board as <UnmaskedBoard>
  participant API as GET /api/unmasked/state
  participant Plan as planUnmaskedLayout
  participant DB as MongoDB

  User->>Board: navigate to /play/unmasked
  Board->>API: GET ?sessionId=...&teamId=...&slug=unmasked
  API->>API: requireAuth (gate cookie)
  API->>DB: UnmaskedState.findOne({sessionId, teamId})
  DB-->>API: null
  API->>DB: GameDefinition.findOne({slug:"unmasked"}).lean()
  DB-->>API: { settings: { gridSize, difficulty, verseCount, versePoolKeys } }
  API->>Plan: planUnmaskedLayout(settings, baseSeed)
  Plan-->>API: { seed, gridSize, totalLies, verseKeys, verseFragments }
  API->>DB: UnmaskedState.findOneAndUpdate(filter, $setOnInsert + $set lastPlayActivityAt, {upsert:true, new:true})
  DB-->>API: created doc
  API-->>Board: full state
  Board->>Board: deserialize, render board
```

The first GET both initializes the run and returns the state. Default values: 3 hearts, status="playing", empty inventory. `startedAt` set to now.

## Reveal flow (single tap)

```mermaid
sequenceDiagram
  actor User
  participant Board as <UnmaskedBoard>
  participant Local as engine (client copy)
  participant API as POST /api/unmasked/action
  participant Engine as engine (server)
  participant DB as MongoDB

  User->>Board: tap a tile (e.g. index 42)
  Board->>Local: applyRevealLocal(state, 42)
  Local-->>Board: optimistic next state + RevealResult
  Board->>Board: paint immediately
  Board->>API: { sessionId, teamId, action: "reveal", index: 42 }
  API->>API: requireAuth, dbConnect
  API->>DB: UnmaskedState.findOne(...)
  API->>Engine: rebuildGameState(doc) → revealTile(state, 42)
  Engine-->>API: RevealResult + mutated state
  API->>DB: UnmaskedState.updateOne $set { revealed, hearts, status, ... }
  API-->>Board: { result, state }
  Board->>Board: reconcile (server wins on conflict)
```

If the tile is a **lie**:
- Without shield: `state.hearts--`. If hearts hit 0 → `status = "lost"`, `finishedAt` set.
- With shield: `state.shielded = false` (consumed), no heart loss.
- Result returned: `{ type: "lie", text, heartsLeft, shieldUsed }`.

If the tile is a **truth**: `floodReveal` cascades through 0-adjacency tiles. Result: `{ type: "number", value, floodRevealed: [...] }`.

If the tile is a **verse**: same as truth (it's a safe tile) but result includes `text, order, verseKey, floodRevealed`.

After reveal, if `checkWin(state)` (every non-lie revealed): `status = "won"`. If `verseKeys` is empty (no verses on this board), the win also sets `passagesComplete = true` and `finishedAt`.

## Verse-check flow

```mermaid
sequenceDiagram
  actor User
  participant Board as <UnmaskedBoard>
  participant API as POST /api/unmasked/action
  participant Engine as trySolveVerseAssembly
  participant DB as MongoDB

  User->>Board: drag fragments into builder, click "Check passage"
  Board->>API: { action: "check_verse", assemblyIndices: [...] }
  API->>API: requireAuth
  API->>DB: UnmaskedState.findOne
  Note over API: must have status === "won" (minefield clear)
  alt status !== "won"
    API-->>Board: ok:false, reason:"Clear minefield first"
  else
    API->>Engine: trySolveVerseAssembly(indices, allFrags, restored)
    alt verdict.ok
      API->>DB: $set versesRestored, verseAssemblyIndices [], (passagesComplete + finishedAt if last)
      API-->>Board: ok:true, verseKey
    else
      Note over API: 30s penalty if not "already restored"
      API->>DB: $set verseAssemblyIndices (preserve), checkPassagePenaltySeconds += 30
      API-->>Board: ok:false, reason, referenceClue, penaltySecondsAdded
    end
  end
```

The penalty adds to the displayed clock. Reference clue (e.g. "Psalm 139:14") is shown only on a wrong attempt — see [engine.ts:206-208](../../app/api/unmasked/action/route.ts#L206-L208) — *as a hint*, not a giveaway.

## Power-up redemption flow

```mermaid
sequenceDiagram
  actor User
  participant Board as <UnmaskedBoard>
  participant API as POST /api/unmasked/redeem
  participant Grant as buildUnmaskedGrantUpdateForPowerUp
  participant DB as MongoDB

  User->>Board: types code "ABC123"
  Board->>API: { sessionId, teamId, code: "ABC123" }
  API->>API: requireAuth, uppercase code
  API->>DB: PowerUpCode.findOne({sessionId, code})
  alt not found
    API-->>Board: 404 invalid code
  end
  alt scope:per_team and code.teamId !== team
    API-->>Board: 403 not for your team
  end
  alt team in code.redeemedBy
    Note over API: repair path — apply once if state.redeemedCodes missing it
    API->>DB: state.redeemedCodes includes code?
    alt no — repair
      API->>Grant: build update for type
      API->>DB: UnmaskedState.updateOne(update)
      API-->>Board: ok:true, repaired:true
    else
      API-->>Board: 400 already redeemed
    end
  else
    API->>DB: PowerUpCode $addToSet redeemedBy
    API->>Grant: buildUnmaskedGrantUpdateForPowerUp
    API->>DB: UnmaskedState.updateOne(update)
    Note over API: on update fail, rollback PowerUpCode push
    API-->>Board: ok:true, applied:autoApply
  end
```

Auto-apply types (`extra_heart`, `shield`) immediately mutate state in the same update — `$inc` for hearts, `$set` for shield. Other types push entries with `used: false` for the player to use later.

## Reset board (self-service "New board")

```mermaid
sequenceDiagram
  actor User
  participant Board as <UnmaskedBoard>
  participant API as POST /api/unmasked/state {reset: true}
  participant Reset as resetUnmaskedBoardKeepTimer
  participant DB as MongoDB

  User->>Board: clicks "New board"
  Board->>API: { sessionId, teamId, reset: true, slug: "unmasked" }
  API->>API: requireAuth
  API->>DB: existing UnmaskedState.findOne
  alt passagesComplete
    API-->>Board: 403 — finished runs can't reshuffle
  end
  API->>Reset: resetUnmaskedBoardKeepTimer(sessionId, teamId, slug)
  Reset->>DB: GameDefinition.findOne({slug})
  Reset->>Reset: planUnmaskedLayout(settings, freshSeed)
  Reset->>DB: PowerUpCode.find({sessionId, code: {$in: keptCodes}}) — refresh inventory
  Reset->>DB: UnmaskedState.findOneAndUpdate $set fresh layout, hearts: 3+bonus, ..., $unset finishedAt/finalScore/scoreBreakdown/submittedAt
  Reset-->>API: doc
  API-->>Board: doc
```

`startedAt` is preserved (the run timer keeps ticking). Bonus hearts and shield are recomputed from the redeemed codes — every redemption replays as if you'd just typed the code again.

## Auto-grant-all flow (admin)

```mermaid
sequenceDiagram
  participant Admin
  participant API as POST /api/admin/unmasked/power-up-grant-all
  participant Grant as buildUnmaskedGrantUpdateForPowerUp
  participant DB as MongoDB

  Admin->>API: { sessionId, codeId }
  API->>API: verifyAdminRequest
  API->>DB: PowerUpCode.findOne(codeId)
  API->>DB: target teams = (universal? all in session : [code.teamId])
  API->>DB: PowerUpCode $addToSet redeemedBy [each]
  loop each team
    API->>DB: UnmaskedState.findOne({sessionId, teamId})
    alt no state
      Note over API: increment teamsWithoutUnmaskedState — they get repair on first state load
    else already has code
      Note over API: skipped
    else
      API->>Grant: build update
      API->>DB: UnmaskedState.updateOne
    end
  end
  API-->>Admin: { targetTeamCount, grantedUnmaskedStates, skippedAlreadyHadCode, teamsWithoutUnmaskedState }
```

Teams without an existing `UnmaskedState` get the grant via the redeem repair path on first state load. The repair check only happens on a literal redeem call though — for the initial load, the team enters the `redeemedBy` list but their `UnmaskedState.redeemedCodes` won't include the code until they manually redeem it again. **(This is a known mild oddity — the auto-grant pre-fills the code's roster but doesn't pre-apply for unborn states.)** See [gotchas.md](./gotchas.md).
