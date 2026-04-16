import type { GameScoring, IGameDefinition } from "@/lib/db/models";
import { GameDefinition, GameResult, Team } from "@/lib/db/models";
import { dbConnect } from "@/lib/db/connect";
import type { ComebackAnalytics, GameScoringRow } from "@/lib/scoring/comeback.types";

export type { ComebackAnalytics, GameScoringRow } from "@/lib/scoring/comeback.types";

function scoringCaps(sc: GameScoring): { max: number; min: number } {
  const pts = sc.placementPoints;
  if (!pts.length) return { max: 0, min: 0 };
  const w = sc.weight ?? 1;
  const rawMax = Math.max(...pts);
  const rawMin = Math.min(...pts);
  return {
    max: Math.round(rawMax * w),
    min: Math.round(rawMin * w),
  };
}

/** A game is “complete” when every team has a result for this session. */
function isGameComplete(
  teamCount: number,
  resultsForGame: number,
): boolean {
  return teamCount > 0 && resultsForGame >= teamCount;
}

export async function getComebackAnalytics(
  sessionId: string,
  teamId: string,
): Promise<ComebackAnalytics | null> {
  await dbConnect();
  const teams = await Team.find({ sessionId }).sort({ sortOrder: 1, name: 1 });
  if (!teams.length) return null;

  const teamList = teams.map((t) => ({
    id: String(t._id),
    name: t.name,
  }));
  const totalTeams = teamList.length;

  const allGames = await GameDefinition.find()
    .sort({ day: 1, order: 1 })
    .lean();

  /** Games that count toward camp total (weight > 0) */
  const weightedGames = allGames.filter(
    (g) => (g.scoring?.weight ?? 0) > 0,
  ) as (IGameDefinition & { _id: unknown })[];

  const results = await GameResult.find({ sessionId }).lean();
  const byGame = new Map<string, typeof results>();
  for (const r of results) {
    const gid = String(r.gameId);
    const arr = byGame.get(gid) ?? [];
    arr.push(r);
    byGame.set(gid, arr);
  }

  const totals = new Map<string, number>();
  for (const t of teamList) totals.set(t.id, 0);
  for (const r of results) {
    const id = String(r.teamId);
    totals.set(id, (totals.get(id) ?? 0) + r.pointsAwarded);
  }

  const sortedByPoints = [...teamList].sort(
    (a, b) => (totals.get(b.id) ?? 0) - (totals.get(a.id) ?? 0),
  );
  const rank =
    sortedByPoints.findIndex((t) => t.id === teamId) + 1 || totalTeams;

  const currentPoints = totals.get(teamId) ?? 0;
  const leaderPoints = Math.max(0, ...teamList.map((t) => totals.get(t.id) ?? 0));
  const gapToLeader = leaderPoints - currentPoints;

  const myIndex = sortedByPoints.findIndex((t) => t.id === teamId);
  const teamAbove =
    myIndex > 0
      ? {
          name: sortedByPoints[myIndex - 1].name,
          points: totals.get(sortedByPoints[myIndex - 1].id) ?? 0,
          gapPoints:
            (totals.get(sortedByPoints[myIndex - 1].id) ?? 0) - currentPoints,
        }
      : null;
  const teamBelow =
    myIndex >= 0 && myIndex < sortedByPoints.length - 1
      ? {
          name: sortedByPoints[myIndex + 1].name,
          points: totals.get(sortedByPoints[myIndex + 1].id) ?? 0,
          gapPoints:
            currentPoints - (totals.get(sortedByPoints[myIndex + 1].id) ?? 0),
        }
      : null;

  const games: GameScoringRow[] = [];
  let sumMaxRemaining = 0;
  let sumMinRemaining = 0;

  for (const g of weightedGames) {
    const sc = g.scoring as GameScoring;
    const caps = scoringCaps(sc);
    const gid = String(g._id);
    const gameResults = byGame.get(gid) ?? [];
    const completed = isGameComplete(totalTeams, gameResults.length);
    const mine = gameResults.find((r) => String(r.teamId) === teamId);
    const yourPlacement = mine ? mine.placement : null;
    const yourPoints = mine ? mine.pointsAwarded : null;

    games.push({
      gameId: gid,
      gameName: g.name,
      slug: g.slug,
      day: g.day,
      weight: sc.weight ?? 1,
      maxPointsThisGame: caps.max,
      minPointsThisGame: caps.min,
      yourPlacement,
      yourPoints,
      completed,
    });

    if (!completed) {
      sumMaxRemaining += caps.max;
      sumMinRemaining += caps.min;
    }
  }

  const yourBestPossibleTotal = currentPoints + sumMaxRemaining;

  const leaderCurrent = totals.get(sortedByPoints[0]?.id ?? "") ?? 0;
  let leaderRemainingMin = 0;
  for (const g of weightedGames) {
    const gid = String(g._id);
    const gameResults = byGame.get(gid) ?? [];
    const completed = isGameComplete(totalTeams, gameResults.length);
    if (!completed) {
      const sc = g.scoring as GameScoring;
      leaderRemainingMin += scoringCaps(sc).min;
    }
  }
  const leaderPessimisticTotal = leaderCurrent + leaderRemainingMin;

  let comebackStillPossible =
    "Focus on the next game — every placement still matters.";
  if (yourBestPossibleTotal > leaderPessimisticTotal) {
    comebackStillPossible =
      "If you take 1st in every remaining game and the leader slips, a comeback is still mathematically possible.";
  } else if (yourBestPossibleTotal <= leaderCurrent) {
    comebackStillPossible =
      "Catching the current leader would require extra scoring opportunities — aim to climb and avoid last place.";
  }

  const pointsToPassNext =
    teamAbove != null ? Math.max(1, teamAbove.gapPoints + 1) : null;

  let pointsToEscapeLast: number | null = null;
  if (rank === totalTeams && totalTeams >= 2) {
    const fifth = sortedByPoints[totalTeams - 2];
    if (fifth) {
      const fifthPts = totals.get(fifth.id) ?? 0;
      pointsToEscapeLast = Math.max(0, fifthPts - currentPoints + 1);
    }
  }

  return {
    teamId,
    teamName: teamList.find((t) => t.id === teamId)?.name ?? "Team",
    rank,
    totalTeams,
    currentPoints,
    leaderPoints,
    gapToLeader,
    teamAbove,
    teamBelow,
    sumMaxRemaining,
    sumMinRemaining,
    yourBestPossibleTotal,
    leaderPessimisticTotal,
    comebackStillPossible,
    pointsToPassNext,
    pointsToEscapeLast,
    games,
  };
}
