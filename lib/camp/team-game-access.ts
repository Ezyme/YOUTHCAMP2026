import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/db/connect";
import { CAMP_TEAM_COOKIE } from "@/lib/camp/auth";
import { GameResult, Session, Team } from "@/lib/db/models";

export type CampTeamScoredGames = {
  sessionId: string;
  teamId: string;
  scoredGameIds: Set<string>;
};

/**
 * Latest camp session + team from cookie, validated on that session, plus game ids
 * that already have a GameResult row for this team (facilitator-published score).
 */
export async function loadCampTeamScoredGames(): Promise<
  { status: "no_session" } | { status: "ok"; data: CampTeamScoredGames }
> {
  await dbConnect();
  const session = await Session.findOne().sort({ createdAt: -1 }).lean();
  if (!session) return { status: "no_session" };

  const jar = await cookies();
  const cookieTeam = jar.get(CAMP_TEAM_COOKIE)?.value ?? "";
  if (!cookieTeam || !mongoose.isValidObjectId(cookieTeam)) {
    redirect(`/login?next=/games`);
  }

  const team = await Team.findOne({
    _id: cookieTeam,
    sessionId: session._id,
  })
    .select("_id")
    .lean();
  if (!team) {
    redirect(`/login?next=/games`);
  }

  const teamId = String(team._id);
  const sessionId = String(session._id);
  const results = await GameResult.find({ sessionId, teamId })
    .select("gameId")
    .lean();
  const scoredGameIds = new Set(results.map((r) => String(r.gameId)));

  return {
    status: "ok",
    data: { sessionId, teamId, scoredGameIds },
  };
}

/** Require camp team cookie + session team match; used on game detail / play. */
export async function requireCampTeamForGameRoute(
  nextPath: string,
): Promise<{ sessionId: string; teamId: string }> {
  await dbConnect();
  const session = await Session.findOne().sort({ createdAt: -1 }).lean();
  if (!session) {
    redirect("/games");
  }

  const jar = await cookies();
  const cookieTeam = jar.get(CAMP_TEAM_COOKIE)?.value ?? "";
  if (!cookieTeam || !mongoose.isValidObjectId(cookieTeam)) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  const team = await Team.findOne({
    _id: cookieTeam,
    sessionId: session._id,
  })
    .select("_id")
    .lean();
  if (!team) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  return { sessionId: String(session._id), teamId: String(team._id) };
}

export async function teamHasGameResult(
  sessionId: string,
  teamId: string,
  gameId: string,
): Promise<boolean> {
  await dbConnect();
  const row = await GameResult.findOne({ sessionId, teamId, gameId })
    .select("_id")
    .lean();
  return row != null;
}
