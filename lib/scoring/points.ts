import type { GameScoring } from "@/lib/db/models";

/** Clamp and round to 2 decimal places for manual category scores. */
export function clampManualPoints(raw: number, max: number): number {
  const n = Number(raw);
  if (Number.isNaN(n)) return 0;
  const c = Math.min(max, Math.max(0, n));
  return Math.round(c * 100) / 100;
}

export function validateManualPointsSet(
  entries: { teamId: string; points: number }[],
  expectedCount: number,
  maxPoints: number,
): { ok: true } | { ok: false; error: string } {
  if (entries.length !== expectedCount) {
    return {
      ok: false,
      error: `Expected exactly ${expectedCount} team scores, got ${entries.length}`,
    };
  }
  const ids = new Set<string>();
  for (const e of entries) {
    if (ids.has(e.teamId)) {
      return { ok: false, error: "Duplicate team in results" };
    }
    ids.add(e.teamId);
    const p = Number(e.points);
    if (Number.isNaN(p) || p < 0 || p > maxPoints) {
      return {
        ok: false,
        error: `Each score must be between 0 and ${maxPoints}`,
      };
    }
  }
  return { ok: true };
}

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
