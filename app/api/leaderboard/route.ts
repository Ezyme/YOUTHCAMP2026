import { NextResponse } from "next/server";
import { getLeaderboard, getTeamBreakdown } from "@/lib/scoring/totals";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");
    const teamId = searchParams.get("teamId");
    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId required" },
        { status: 400 },
      );
    }
    if (teamId) {
      const breakdown = await getTeamBreakdown(sessionId, teamId);
      return NextResponse.json({ breakdown });
    }
    const leaderboard = await getLeaderboard(sessionId);
    return NextResponse.json({ leaderboard });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
