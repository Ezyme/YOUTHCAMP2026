import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db/connect";
import { PowerUpCode, Session, Team } from "@/lib/db/models";
import mongoose from "mongoose";

export async function GET(req: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");
    if (!sessionId || !mongoose.isValidObjectId(sessionId)) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    }
    const codes = await PowerUpCode.find({ sessionId }).sort({ createdAt: 1 }).lean();

    const teamIds = [
      ...new Set(codes.flatMap((c) => [
        ...(c.teamId ? [String(c.teamId)] : []),
        ...c.redeemedBy.map(String),
      ])),
    ].filter(mongoose.isValidObjectId);

    const teams = teamIds.length
      ? await Team.find({ _id: { $in: teamIds } }).select("name").lean()
      : [];
    const teamMap = new Map(teams.map((t) => [String(t._id), t.name]));

    const enriched = codes.map((c) => ({
      ...c,
      teamName: c.teamId ? teamMap.get(String(c.teamId)) ?? null : null,
      redeemedByNames: c.redeemedBy.map((id) => teamMap.get(String(id)) ?? String(id)),
    }));

    return NextResponse.json(enriched);
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
    if (!mongoose.isValidObjectId(sessionId)) {
      return NextResponse.json({ error: "Invalid sessionId" }, { status: 400 });
    }

    const code = String(body.code ?? "").trim().toUpperCase();
    if (!code) {
      return NextResponse.json({ error: "Code required" }, { status: 400 });
    }

    const session = await Session.findById(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const doc = await PowerUpCode.create({
      sessionId,
      code,
      powerUpType: body.powerUpType ?? "extra_heart",
      scope: body.scope ?? "universal",
      teamId: body.teamId && mongoose.isValidObjectId(body.teamId) ? body.teamId : null,
      redeemedBy: [],
    });

    return NextResponse.json(doc);
  } catch (e) {
    if ((e as { code?: number }).code === 11000) {
      return NextResponse.json({ error: "Code already exists for this session" }, { status: 400 });
    }
    const message = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id || !mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    await PowerUpCode.deleteOne({ _id: id });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
