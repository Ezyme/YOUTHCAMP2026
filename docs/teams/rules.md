# teams — rules

## MUST

- **Always exclude `passwordHash` from list / GET responses.** The schema's `select: false` does this automatically. Only the bcrypt-verify path should ever read it.
- **Always lowercase + trim `loginUsername`** at the API boundary. The schema enforces lowercase + trim at the storage level, but be explicit at the API too.
- **Always use `mongoose.isValidObjectId(id)` at the boundary** before touching the DB.
- **The 6-team bootstrap mode is gated by zero-team check.** Don't bypass — it would create duplicate "Team 1" rows.
- **Always require `password.length >= 3`** for bulk PATCH. Anything shorter is operationally bad — the password should at least take an effort to type.

## MUST NOT

- **Never expose `passwordHash` in any response.** Schema's `select: false` protects against accidental leaks; explicit reads (`select("+passwordHash")`) must keep the value internal.
- **Never delete a team without considering cascades.** Today there's no cascade. A future fix should at minimum delete `UnmaskedState` and `MindgameState` for the team. `GameResult` rows should likely stay (audit trail) but this is a policy choice.
- **Never accept `password` directly on POST `/api/teams`.** New team creation doesn't set a password. Use `PATCH /api/teams` (bulk) afterwards.
- **Never duplicate the 6-team default colors / names** without keeping them in sync with `lib/seed/camp-games.ts` (which has its own copy via the seed route's inline list).
- **Never bypass `hashPassword`** when writing `passwordHash`. Plaintext is never persisted.
- **Never expose `/api/teams` to public mutation in a stricter threat model.** Today it's open by convention. If you need to gate, add `verifyAdminRequest()`.
- **Never change `loginUsername` or `passwordHash` on a team that is currently logged in without telling them.** The cookie persists for 14 days; their existing session keeps working until it expires.
