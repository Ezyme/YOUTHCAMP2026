import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/admin-auth";
import { dbConnect } from "@/lib/db/connect";
import { UnmaskedState } from "@/lib/db/models";
import { migrateLegacyUnmaskedState } from "@/lib/games/unmasked/migrate-legacy-unmasked";
import mongoose from "mongoose";

function parseOid(id: string | null | undefined): mongoose.Types.ObjectId | null {
  if (!id || !mongoose.isValidObjectId(id)) return null;
  return new mongoose.Types.ObjectId(id);
}

/** Read-only: returns existing state only (no upsert). For admin spectator view. */
export async function GET(req: Request) {
  try {
    if (!(await verifyAdminRequest())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const sessionId = parseOid(searchParams.get("sessionId"));
    const teamId = parseOid(searchParams.get("teamId"));
    if (!sessionId || !teamId) {
      return NextResponse.json({ error: "sessionId and teamId required" }, { status: 400 });
    }

    let state = await UnmaskedState.findOne({ sessionId, teamId }).lean();
    if (!state) {
      return NextResponse.json({ error: "No saved game for this team yet" }, { status: 404 });
    }
    await migrateLegacyUnmaskedState(
      state as unknown as Record<string, unknown> & { _id: mongoose.Types.ObjectId },
    );
    state = await UnmaskedState.findOne({ sessionId, teamId }).lean();
    return NextResponse.json(state);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
