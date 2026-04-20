import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/admin-auth";
import { dbConnect } from "@/lib/db/connect";
import { Team, UnmaskedState } from "@/lib/db/models";
import mongoose from "mongoose";

function parseOid(id: string | null | undefined): mongoose.Types.ObjectId | null {
  if (!id || !mongoose.isValidObjectId(id)) return null;
  return new mongoose.Types.ObjectId(id);
}

export async function GET(req: Request) {
  try {
    if (!(await verifyAdminRequest())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const sessionId = parseOid(searchParams.get("sessionId"));
    if (!sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    }

    const teams = await Team.find({ sessionId }).sort({ sortOrder: 1 }).lean();
    const teamIds = teams.map((t) => t._id);
    const states = await UnmaskedState.find({ sessionId, teamId: { $in: teamIds } }).lean();
    const byTeam = new Map(states.map((s) => [String(s.teamId), s]));

    const rows = teams.map((t) => {
      const id = String(t._id);
      const st = byTeam.get(id);
      if (!st) {
        return {
          teamId: id,
          teamName: t.name,
          color: t.color,
          hasState: false as const,
        };
      }
      const gridSize = Number(st.gridSize ?? 0);
      const totalLies = Number(st.totalLies ?? 0);
      const totalCells = gridSize > 0 ? gridSize * gridSize : 0;
      const revealed = (st.revealed as number[]) ?? [];

      return {
        teamId: id,
        teamName: t.name,
        color: t.color,
        hasState: true as const,
        status: st.status,
        passagesComplete: Boolean(st.passagesComplete),
        hearts: st.hearts,
        maxHearts: st.maxHearts,
        liesHit: st.liesHit,
        shielded: st.shielded,
        gridSize,
        totalLies,
        totalCells,
        revealedCount: revealed.length,
        redeemedCodes: (st.redeemedCodes as string[]) ?? [],
        powerUps: st.powerUps,
        startedAt: st.startedAt,
        finishedAt: st.finishedAt,
        checkPassagePenaltySeconds: st.checkPassagePenaltySeconds ?? 0,
        verseKeys: (st.verseKeys as string[]) ?? [],
        versesRestored: (st.versesRestored as string[]) ?? [],
      };
    });

    return NextResponse.json({ teams: rows });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
