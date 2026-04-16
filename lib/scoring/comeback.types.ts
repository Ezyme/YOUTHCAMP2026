/** Client-safe types for comeback / team dashboard (no DB imports). */

export type GameScoringRow = {
  gameId: string;
  gameName: string;
  slug: string;
  day: number;
  weight: number;
  maxPointsThisGame: number;
  minPointsThisGame: number;
  yourPlacement: number | null;
  yourPoints: number | null;
  completed: boolean;
};

export type ComebackAnalytics = {
  teamId: string;
  teamName: string;
  rank: number;
  totalTeams: number;
  currentPoints: number;
  leaderPoints: number;
  gapToLeader: number;
  teamAbove: { name: string; points: number; gapPoints: number } | null;
  teamBelow: { name: string; points: number; gapPoints: number } | null;
  sumMaxRemaining: number;
  sumMinRemaining: number;
  yourBestPossibleTotal: number;
  leaderPessimisticTotal: number;
  comebackStillPossible: string;
  pointsToPassNext: number | null;
  pointsToEscapeLast: number | null;
  games: GameScoringRow[];
};
