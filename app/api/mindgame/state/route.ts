import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { CAMP_AUTH_COOKIE, isCampGateEnabled } from "@/lib/camp/auth";
import { dbConnect } from "@/lib/db/connect";
import { MindgameState } from "@/lib/db/models";
import mongoose from "mongoose";

async function requireCampAuthIfEnabled(): Promise<boolean> {
  if (!isCampGateEnabled()) return true;
  const jar = await cookies();
  return jar.get(CAMP_AUTH_COOKIE)?.value === "1";
}

function parseOid(id: string | null | undefined): mongoose.Types.ObjectId | null {
  if (!id || !mongoose.isValidObjectId(id)) return null;
  return new mongoose.Types.ObjectId(id);
}

export async function POST(req: Request) {
  try {
    if (!(await requireCampAuthIfEnabled())) {
      return NextResponse.json({ error: "Login required" }, { status: 401 });
    }
    await dbConnect();
    const body = await req.json();
    const sessionId = parseOid(
      body.sessionId ? String(body.sessionId) : null,
    );
    const teamId = parseOid(body.teamId ? String(body.teamId) : null);
    const clientKey = String(body.clientKey ?? "default");

    const filter: Record<string, unknown> = { clientKey, sessionId, teamId };

    const doc = await MindgameState.findOneAndUpdate(
      filter,
      {
        $set: {
          clientKey,
          sessionId,
          teamId,
          gridRows: Number(body.gridRows),
          gridCols: Number(body.gridCols),
          playerCount: Number(body.playerCount),
          positions: body.positions ?? [],
          blocked: Array.isArray(body.blocked) ? body.blocked : [],
          diagonalNodes: Array.isArray(body.diagonalNodes) ? body.diagonalNodes : [],
          goal: String(body.goal ?? "sort_desc"),
          moves: Number(body.moves ?? 0),
        },
      },
      { upsert: true, new: true },
    );
    return NextResponse.json(doc);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    if (!(await requireCampAuthIfEnabled())) {
      return NextResponse.json({ error: "Login required" }, { status: 401 });
    }
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const clientKey = searchParams.get("clientKey") ?? "default";
    const sessionId = parseOid(searchParams.get("sessionId"));
    const teamId = parseOid(searchParams.get("teamId"));
    const doc = await MindgameState.findOne({ clientKey, sessionId, teamId })
      .sort({ updatedAt: -1 })
      .lean();
    return NextResponse.json(doc);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
