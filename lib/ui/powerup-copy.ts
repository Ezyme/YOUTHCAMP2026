import type { PowerUpType } from "@/lib/db/models";

/** Short, human-readable copy shown in toasts and on the in-board armed banner.
 * Keep each string under ~110 chars so it reads clearly on mobile toasts. */
export const POWER_UP_SHORT: Record<PowerUpType, string> = {
  extra_heart: "Extra Heart: +1 max heart, auto-applied.",
  reveal: "Reveal: opens a random safe area. 5 charges per code.",
  scout: "Scout: arm, then tap a hidden tile to peek Lie vs Truth. 3 charges.",
  shield: "Shield: blocks the next lie — auto-applied.",
  safe_opening: "Safe Opening: auto-clears the largest zero patch.",
  truth_radar: "Truth Radar: arm, tap a tile, pick Row/Column — reveals every truth on that line.",
  lie_pin: "Lie Pin: arm, tap a tile — pins the nearest hidden lie. 2 charges.",
  verse_compass: "Verse Compass: arm, tap a tile — reveals 2 nearest fragments. 2 charges.",
  gentle_step: "Gentle Step: arm, tap a tile — opens only the nearest safe square. 2 charges.",
};

/** Friendly label for toasts (e.g. "Unlocked: Scout ×3 — …"). */
export const POWER_UP_NAME: Record<PowerUpType, string> = {
  extra_heart: "Extra Heart",
  reveal: "Reveal",
  scout: "Scout",
  shield: "Shield",
  safe_opening: "Safe Opening",
  truth_radar: "Truth Radar",
  lie_pin: "Lie Pin",
  verse_compass: "Verse Compass",
  gentle_step: "Gentle Step",
};

/** Tooltip/long-press hint copy — shown on hover (desktop) and long-press (touch). */
export const POWER_UP_HINT: Record<PowerUpType, string> = POWER_UP_SHORT;

/** Short in-board banner when a power-up is armed. */
export const POWER_UP_ARMED_BANNER: Record<PowerUpType, string> = {
  extra_heart: "",
  reveal: "",
  scout: "Scout armed — tap a hidden tile to peek Lie vs Truth.",
  shield: "",
  safe_opening: "",
  truth_radar: "Truth Radar armed — tap a tile, then choose Row or Column.",
  lie_pin: "Lie Pin armed — tap a tile to pin the nearest hidden lie.",
  verse_compass: "Verse Compass armed — tap a tile to reveal 2 nearest fragments.",
  gentle_step: "Gentle Step armed — tap a tile to open the nearest safe square.",
};
