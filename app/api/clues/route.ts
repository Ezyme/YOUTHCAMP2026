import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db/connect";
import { Clue } from "@/lib/db/models";
import mongoose from "mongoose";

export async function GET(req: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");
    const teamId = searchParams.get("teamId");
    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId required" },
        { status: 400 },
      );
    }
    const q: Record<string, unknown> = { sessionId };
    if (teamId) q.teamId = teamId;
    const clues = await Clue.find(q).sort({ order: 1, createdAt: 1 }).lean();
    return NextResponse.json(clues);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await dbConnect();
    const body = await req.json();
    const sessionId = String(body.sessionId ?? "");
    const teamId = String(body.teamId ?? "");
    if (!mongoose.isValidObjectId(sessionId) || !mongoose.isValidObjectId(teamId)) {
      return NextResponse.json({ error: "Invalid ids" }, { status: 400 });
    }
    const doc = await Clue.create({
      sessionId,
      teamId,
      sourceGameSlug: String(body.sourceGameSlug ?? ""),
      text: String(body.text ?? ""),
      order: Number(body.order ?? 0),
      revealedAt: body.revealedAt ? new Date(body.revealedAt) : undefined,
    });
    return NextResponse.json(doc);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
