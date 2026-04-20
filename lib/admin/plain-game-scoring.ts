import type { GameScoring } from "@/lib/db/models";

/** Strip Mongoose subdoc metadata (e.g. `_id` buffers) for Client Component props. */
export function plainGameScoring(
  sc: GameScoring | null | undefined,
): GameScoring {
  return {
    maxPlacements: sc?.maxPlacements ?? 6,
    scoringMode: sc?.scoringMode ?? "placement_points",
    placementPoints: [...(sc?.placementPoints ?? [12, 11, 10, 9, 8, 7])],
    weight: sc?.weight ?? 1,
    ...(typeof sc?.manualPointsMax === "number"
      ? { manualPointsMax: sc.manualPointsMax }
      : {}),
  };
}
