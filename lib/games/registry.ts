import type { EngineKey } from "@/lib/db/models";

export const ENGINE_LABELS: Record<EngineKey, string> = {
  mindgame: "Mindgame (grid planner)",
  unmasked: "Unmasked (identity minefield)",
  config_only: "Configurable (no in-app play yet)",
};

export function playPathForEngine(
  slug: string,
  engineKey: EngineKey,
): string | null {
  if (engineKey === "mindgame" || engineKey === "unmasked") {
    return `/play/${slug}`;
  }
  return null;
}
