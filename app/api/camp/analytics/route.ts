import { NextResponse } from "next/server";
import { getComebackAnalytics } from "@/lib/scoring/comeback";
import mongoose from "mongoose";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");
    const teamId = searchParams.get("teamId");
    if (!sessionId || !teamId) {
      return NextResponse.json(
        { error: "sessionId and teamId required" },
        { status: 400 },
      );
    }
    if (!mongoose.isValidObjectId(sessionId) || !mongoose.isValidObjectId(teamId)) {
      return NextResponse.json({ error: "Invalid ids" }, { status: 400 });
    }
    const data = await getComebackAnalytics(sessionId, teamId);
    if (!data) {
      return NextResponse.json({ error: "No data" }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
