import type { EngineKey } from "@/lib/db/models";

export const ENGINE_LABELS: Record<EngineKey, string> = {
  mindgame: "Mindgame (grid planner)",
  final_solving: "Final Solving (puzzle)",
  unmasked: "Unmasked (identity minefield)",
  config_only: "Configurable (no in-app play yet)",
};

export function playPathForEngine(
  slug: string,
  engineKey: EngineKey,
): string | null {
  if (engineKey === "mindgame" || engineKey === "final_solving" || engineKey === "unmasked") {
    return `/play/${slug}`;
  }
  return null;
}
