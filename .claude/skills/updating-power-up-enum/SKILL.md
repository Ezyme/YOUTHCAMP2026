---
name: updating-power-up-enum
description: Use when adding, removing, or renaming a power-up in the unmasked engine. Triggers on phrases like "new power-up", "add power up", "rename power-up", "extra heart", "shield", "verse compass", or anything touching PowerUpType.
---

# updating-power-up-enum

## When to use
You are changing the closed set of power-ups available in the unmasked engine. The set is **duplicated** across the `PowerUpType` TypeScript union and the `UNMASKED_POWER_UP_ENUM` array (both in `lib/db/models.ts`); divergence causes silent validation failures because Mongoose only enforces the runtime array.

## Steps
1. **Edit `lib/db/models.ts` in the same edit:**
   - Add/remove/rename in the `PowerUpType` union.
   - Add/remove/rename the matching string in `UNMASKED_POWER_UP_ENUM`.
   - The union and array MUST be 1:1 in length and order.
2. **Player-facing copy** — add or update the entry in `lib/ui/powerup-copy.ts` (icon, label, short description shown to players).
3. **Engine logic** — if the power-up has effect logic (most do), wire it into `lib/games/unmasked/engine.ts`. Add the redemption grant (if applicable) to `lib/games/unmasked/redeem-grants.ts` and the corresponding `lib/games/unmasked/redemption-grant.ts`.
4. **Admin UI** — `components/admin/power-ups-admin.tsx` lists known power-ups for code-issuance; extend it so admins can mint codes for the new type.
5. **Codes** — `PowerUpCode.powerUpType` enum is the same `UNMASKED_POWER_UP_ENUM`; nothing extra to do for that schema, but **dev HMR clears `mongoose.models.PowerUpCode`** in `lib/db/models.ts` for exactly this reason — leave that delete-on-dev pattern in place.
6. **Docs** — update `docs/unmasked/rules.md` (or `gotchas.md` if removing) and `docs/unmasked/api.md` if the redeem endpoint shape changes.

## Conventions
- Names: snake_case, singular (`extra_heart`, not `extraHearts`). Match the existing style.
- Removing a power-up that any production board may have already granted is a **breaking** change — surface it to the user explicitly. The minimum-disruption path is to keep the type defined but disable issuance in admin UI.
- If you add a power-up that interacts with verse assembly (`verse_compass`, `truth_radar`, etc.), check `lib/games/unmasked/verses.ts` and `lib/games/unmasked/plan-layout.ts` for hardcoded type lists you may need to extend.

## Verification
```bash
npm run lint
npm run typecheck
npm run dev
```
Then manually:
1. Boot the admin panel, mint a redemption code for the new power-up.
2. Log in as a team, redeem it on `/play/<unmasked-slug>`, confirm the grant lands on the team's `UnmaskedState.powerUps`.
3. Trigger the power-up in-game and confirm the engine effect.

If any step silently 422s with a Mongoose validation error like `is not a valid enum value for path 'type'`, the union and the array are still out of sync — re-check `lib/db/models.ts`. Do not commit; ask the user.
