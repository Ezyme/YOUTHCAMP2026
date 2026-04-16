import type { GameScoring } from "@/lib/db/models";

/** placement is 1-based (1st place → index 0) */
export function pointsForPlacement(
  scoring: GameScoring,
  placement: number,
): number {
  const idx = placement - 1;
  const row = scoring.placementPoints;
  if (idx < 0 || idx >= row.length) {
    throw new Error(`Invalid placement ${placement}; expected 1–6`);
  }
  const base = row[idx] ?? 0;
  return Math.round(base * (scoring.weight ?? 1));
}

export function validatePlacementSet(
  entries: { teamId: string; placement: number }[],
  maxPlacements: number,
): { ok: true } | { ok: false; error: string } {
  if (entries.length !== maxPlacements) {
    return {
      ok: false,
      error: `Expected exactly ${maxPlacements} team results, got ${entries.length}`,
    };
  }
  const placements = entries.map((e) => e.placement).sort((a, b) => a - b);
  const expected = Array.from({ length: maxPlacements }, (_, i) => i + 1);
  const unique = new Set(placements);
  if (unique.size !== placements.length) {
    return { ok: false, error: "Duplicate placements are not allowed" };
  }
  for (let i = 0; i < maxPlacements; i++) {
    if (placements[i] !== expected[i]) {
      return {
        ok: false,
        error: `Placements must be exactly 1 through ${maxPlacements} with no gaps`,
      };
    }
  }
  return { ok: true };
}
