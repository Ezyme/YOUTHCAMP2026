import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/admin-auth";
import { dbConnect } from "@/lib/db/connect";
import { UnmaskedState } from "@/lib/db/models";
import { resetUnmaskedBoardKeepTimer } from "@/lib/games/unmasked/reset-board";
import mongoose from "mongoose";

function parseOid(id: unknown): mongoose.Types.ObjectId | null {
  if (typeof id !== "string" || !mongoose.isValidObjectId(id)) return null;
  return new mongoose.Types.ObjectId(id);
}

type ResetAction = "timer" | "board";

export async function POST(req: Request) {
  try {
    if (!(await verifyAdminRequest())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    await dbConnect();
    const body = await req.json().catch(() => ({}));
    const sessionId = parseOid(body.sessionId);
    const teamId = parseOid(body.teamId);
    const action = body.action as ResetAction | undefined;
    const slug = String(body.slug ?? "unmasked");

    if (!sessionId || !teamId) {
      return NextResponse.json({ error: "sessionId and teamId required" }, { status: 400 });
    }
    if (action !== "timer" && action !== "board") {
      return NextResponse.json({ error: 'action must be "timer" or "board"' }, { status: 400 });
    }

    const existing = await UnmaskedState.findOne({ sessionId, teamId }).lean();
    if (!existing) {
      return NextResponse.json({ error: "No game state for this team" }, { status: 404 });
    }

    if (action === "timer") {
      const doc = await UnmaskedState.findOneAndUpdate(
        { sessionId, teamId },
        {
          $set: {
            startedAt: new Date(),
            checkPassagePenaltySeconds: 0,
            lastPlayActivityAt: null,
          },
        },
        { new: true },
      ).lean();
      return NextResponse.json(doc);
    }

    const doc = await resetUnmaskedBoardKeepTimer(sessionId, teamId, slug);
    if (!doc) {
      return NextResponse.json({ error: "Failed to reset board" }, { status: 500 });
    }
    return NextResponse.json(doc);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
