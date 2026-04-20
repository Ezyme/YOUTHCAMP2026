import type {
  GameScoring,
  IGameDefinition,
  ScoringMode,
} from "@/lib/db/models";
import { GameDefinition, GameResult, Team } from "@/lib/db/models";
import { dbConnect } from "@/lib/db/connect";

export type LeaderboardRow = {
  teamId: string;
  teamName: string;
  color: string;
  totalPoints: number;
  behindLeader: number;
};

export type ScoreBreakdownRow = {
  gameId: string;
  gameName: string;
  slug: string;
  day: number;
  category: string;
  placement: number;
  pointsAwarded: number;
  placementPointsRow: number[];
  weight: number;
  scoringMode: ScoringMode;
  /** Rubric points for this finish (before weight). Omitted for judge-entered events. */
  basePlacementPoints?: number;
  manualPointsMax?: number;
};

export async function getLeaderboard(
  sessionId: string,
): Promise<LeaderboardRow[]> {
  await dbConnect();
  const teams = await Team.find({ sessionId }).sort({ sortOrder: 1, name: 1 });
  const results = await GameResult.find({ sessionId });

  const byTeam = new Map<string, number>();
  for (const t of teams) {
    byTeam.set(String(t._id), 0);
  }
  for (const r of results) {
    const id = String(r.teamId);
    byTeam.set(id, (byTeam.get(id) ?? 0) + r.pointsAwarded);
  }

  const rows: LeaderboardRow[] = teams.map((t) => ({
    teamId: String(t._id),
    teamName: t.name,
    color: t.color,
    totalPoints: byTeam.get(String(t._id)) ?? 0,
    behindLeader: 0,
  }));

  const max = Math.max(0, ...rows.map((r) => r.totalPoints));
  for (const r of rows) {
    r.behindLeader = max - r.totalPoints;
  }
  rows.sort((a, b) => b.totalPoints - a.totalPoints);
  return rows;
}

export async function getTeamBreakdown(
  sessionId: string,
  teamId: string,
): Promise<ScoreBreakdownRow[]> {
  await dbConnect();
  const results = await GameResult.find({ sessionId, teamId });
  const gameIds = [...new Set(results.map((r) => String(r.gameId)))];
  const games = await GameDefinition.find({
    _id: { $in: gameIds },
  });
  const gameMap = new Map<string, IGameDefinition & { _id: unknown }>(
    games.map((g) => [String(g._id), g as IGameDefinition & { _id: unknown }]),
  );

  const rows: ScoreBreakdownRow[] = [];
  for (const r of results) {
    const g = gameMap.get(String(r.gameId));
    if (!g) continue;
    const sc = g.scoring as GameScoring;
    const mode = sc.scoringMode ?? "placement_points";
    const idx = r.placement - 1;
    const baseOk = idx >= 0 && idx < sc.placementPoints.length;
    const basePlacementPoints =
      mode === "manual_points" || !baseOk
        ? undefined
        : (sc.placementPoints[idx] ?? 0);
    rows.push({
      gameId: String(g._id),
      gameName: g.name,
      slug: g.slug,
      day: g.day,
      category: g.category,
      placement: r.placement,
      pointsAwarded: r.pointsAwarded,
      placementPointsRow: [...sc.placementPoints],
      weight: sc.weight,
      scoringMode: mode,
      basePlacementPoints,
      manualPointsMax:
        mode === "manual_points" ? sc.manualPointsMax : undefined,
    });
  }
  rows.sort((a, b) => a.day - b.day || a.gameName.localeCompare(b.gameName));
  return rows;
}

