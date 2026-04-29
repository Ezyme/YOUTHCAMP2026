import type { PowerUpType } from "@/lib/db/models";

/** Short, human-readable copy shown in toasts and on the in-board armed banner.
 * Keep each string under ~110 chars so it reads clearly on mobile toasts. */
export const POWER_UP_SHORT: Record<PowerUpType, string> = {
  extra_heart: "Abundant Grace: +1 max heart, auto-applied.",
  reveal: "Glimmer of Hope: opens a random safe area. 5 charges per code.",
  scout: "Prophetic Vision: arm, then tap a hidden tile to peek Lie vs Truth. 3 charges.",
  shield: "Armor of Truth: blocks the next lie — auto-applied.",
  safe_opening: "Divine Blueprint: auto-clears the largest zero patch.",
  truth_radar: "Light of Discernment: arm, tap a tile, pick Row/Column — reveals every truth on that line.",
  lie_pin: "Exposing the Dark: arm, tap a tile — pins the nearest hidden lie. 2 charges.",
  verse_compass: "Living Word: arm, tap a tile — reveals 2 nearest fragments. 2 charges.",
  gentle_step: "Steadfast Path: arm, tap a tile — opens only the nearest safe square. 2 charges.",
};

/** Friendly label for toasts (e.g. "Unlocked: Prophetic Vision ×3 — …"). */
export const POWER_UP_NAME: Record<PowerUpType, string> = {
  extra_heart: "Abundant Grace",
  reveal: "Glimmer of Hope",
  scout: "Prophetic Vision",
  shield: "Armor of Truth",
  safe_opening: "Divine Blueprint",
  truth_radar: "Light of Discernment",
  lie_pin: "Exposing the Dark",
  verse_compass: "Living Word",
  gentle_step: "Steadfast Path",
};

/** Tooltip/long-press hint copy — shown on hover (desktop) and long-press (touch). */
export const POWER_UP_HINT: Record<PowerUpType, string> = POWER_UP_SHORT;

/** Short in-board banner when a power-up is armed. */
export const POWER_UP_ARMED_BANNER: Record<PowerUpType, string> = {
  extra_heart: "",
  reveal: "",
  scout: "Prophetic Vision armed — tap a hidden tile to peek Lie vs Truth.",
  shield: "",
  safe_opening: "",
  truth_radar: "Light of Discernment armed — tap a tile, then choose Row or Column.",
  lie_pin: "Exposing the Dark armed — tap a tile to pin the nearest hidden lie.",
  verse_compass: "Living Word armed — tap a tile to reveal 2 nearest fragments.",
  gentle_step: "Steadfast Path armed — tap a tile to open the nearest safe square.",
};
