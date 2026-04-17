import type { PowerUpType } from "@/lib/db/models";

/** Each redeemed "reveal" code grants this many separate uses (inventory entries). */
export const REVEAL_CHARGES_PER_REDEMPTION = 5;

/** Per-type charges granted per redeem. Tuned to help players without making the game trivial. */
const CHARGES_PER_REDEMPTION: Partial<Record<PowerUpType, number>> = {
  reveal: REVEAL_CHARGES_PER_REDEMPTION,
  scout: 3,
  gentle_step: 2,
  lie_pin: 2,
  verse_compass: 2,
};

export function chargesFor(powerUpType: PowerUpType): number {
  return CHARGES_PER_REDEMPTION[powerUpType] ?? 1;
}

export function powerUpEntriesForRedemption(
  powerUpType: PowerUpType,
): { type: PowerUpType; used: boolean }[] {
  const n = chargesFor(powerUpType);
  return Array.from({ length: n }, () => ({ type: powerUpType, used: false }));
}
