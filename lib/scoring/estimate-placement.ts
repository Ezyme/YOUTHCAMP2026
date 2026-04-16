import type { GameScoringRow } from "@/lib/scoring/comeback.types";

/** Rough heuristic: lower avg placement number = better. */
export function estimateAvgPlacementToClose(
  gapPoints: number,
  remainingGames: GameScoringRow[],
): string {
  if (gapPoints <= 0 || !remainingGames.length) return "—";
  const open = remainingGames.filter((g) => !g.completed);
  if (!open.length) return "—";
  let sumSpread = 0;
  for (const g of open) {
    sumSpread += Math.max(0, g.maxPointsThisGame - g.minPointsThisGame);
  }
  if (sumSpread <= 0) return "—";
  const ratio = Math.min(1, gapPoints / sumSpread);
  const est = 1 + ratio * 5;
  return `~${est.toFixed(1)} avg. place (rough)`;
}
