import type { PowerUpType } from "@/lib/db/models";
import { chargesFor, powerUpEntriesForRedemption } from "@/lib/games/unmasked/redeem-grants";

/** Power-ups that apply automatically at redemption (no arming step). */
const AUTO_APPLY: ReadonlySet<PowerUpType> = new Set(["extra_heart", "shield"]);

/** Build redemption entries; auto-applied types are marked used=true. */
export function buildRedemptionEntries(type: PowerUpType): { type: PowerUpType; used: boolean }[] {
  const base = powerUpEntriesForRedemption(type);
  if (!AUTO_APPLY.has(type)) return base;
  return base.map((e) => ({ ...e, used: true }));
}

/** Update for auto-applied side effects (hearts++, shield on). */
export function autoApplyUpdateForRedemption(
  type: PowerUpType,
  count: number,
): Record<string, unknown> | null {
  if (type === "extra_heart") {
    return { $inc: { maxHearts: count, hearts: count } };
  }
  if (type === "shield") {
    return { $set: { shielded: true } };
  }
  return null;
}

/** Mongo update document for UnmaskedState: grant one code redemption (matches POST /api/unmasked/redeem). */
export function buildUnmaskedGrantUpdateForPowerUp(
  codeUpper: string,
  type: PowerUpType,
): Record<string, unknown> {
  const entries = buildRedemptionEntries(type);
  const auto = autoApplyUpdateForRedemption(type, chargesFor(type));
  const $set: Record<string, unknown> = { lastPlayActivityAt: new Date() };
  if (auto?.$set) Object.assign($set, auto.$set as Record<string, unknown>);
  const update: Record<string, unknown> = {
    $addToSet: { redeemedCodes: codeUpper },
    $push: { powerUps: { $each: entries } },
    $set,
  };
  if (auto?.$inc) update.$inc = auto.$inc;
  return update;
}

export const AUTO_APPLY_POWER_UP_TYPES = AUTO_APPLY;
