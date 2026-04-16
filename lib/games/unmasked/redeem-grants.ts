import type { PowerUpType } from "@/lib/db/models";

/** Each redeemed "reveal" code grants this many separate uses (inventory entries). */
export const REVEAL_CHARGES_PER_REDEMPTION = 5;

export function powerUpEntriesForRedemption(
  powerUpType: PowerUpType,
): { type: PowerUpType; used: boolean }[] {
  if (powerUpType === "reveal") {
    return Array.from({ length: REVEAL_CHARGES_PER_REDEMPTION }, () => ({
      type: powerUpType,
      used: false,
    }));
  }
  return [{ type: powerUpType, used: false }];
}
