# games-shared — rules

## MUST

- **`GameDefinition.slug` must be unique.** The schema enforces it; the seed and `ensure-game-definition` rely on it.
- **`placementPoints` must be exactly 6 entries.** Schema validator rejects otherwise.
- **`isPlayable === true`** only for `engineKey === "mindgame"` or `"unmasked"`. `config_only` games must be `isPlayable: false`.
- **Day 0 games stay hidden** from `/games` and `/games/[slug]` (notFound). They're reference rows (merit, etc.) — not played events.
- **Always validate placements via `validatePlacementSet`** before computing points. The validator catches gaps, duplicates, and wrong counts.
- **Always compute weighted points via `pointsForPlacement(scoring, placement)`.** Don't read `placementPoints[idx]` directly — that skips the weight multiplier.
- **Always upsert game results via the unique tuple `(sessionId, gameId, teamId)`.** `bulkWrite` with `upsert: true` is the canonical pattern. The unique compound index prevents duplicates.
- **Always pass game scoring through `plainGameScoring` before rendering on the client.** Mongoose subdoc `_id` buffers crash React server-to-client serialization.
- **Always check `mongoose.isValidObjectId(id)` at the API boundary** before calling Mongoose with a user-supplied id.

## MUST NOT

- **Never inline scoring math** in API handlers. Use `lib/scoring/points.ts`. The handler should parse + validate + delegate + write.
- **Never let a Day 1–2 game render on `/games` without a scored result for the team.** That's the scoreboard-reveal contract. `loadCampTeamScoredGames` enforces it; don't bypass.
- **Never expose `/api/games/*` to public mutation in a stricter threat model without adding admin auth.** Today they're open. If you tighten, add `verifyAdminRequest()`.
- **Never delete a `GameDefinition` while expecting cascades.** `GameResult` rows orphan silently. `getTeamBreakdown` filters them out, but the rows remain. Decide whether to delete-and-orphan or scrub `GameResult` first.
- **Never bypass `ensureGameDefinitionBySlug` in `/play/[gameSlug]`** — without it, a fresh DB can't render the playable engines until someone runs the full seed. The auto-create exists for this reason.
- **Never route `config_only` games to `/play/<slug>`.** The page renders a placeholder, but the link should point to `/games/<slug>` instead — see `/games` page logic.
