import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db/connect";
import { Team } from "@/lib/db/models";
import { hashPassword } from "@/lib/camp/password";
import { syncTeamLoginsForSession } from "@/lib/seed/sync-team-logins";
import mongoose from "mongoose";

export async function GET(req: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");
    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId query required" },
        { status: 400 },
      );
    }
    const teams = await Team.find({ sessionId })
      .select("-passwordHash")
      .sort({ sortOrder: 1, name: 1 });
    return NextResponse.json(teams);
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
    if (!sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    }
    if (body.bootstrap) {
      const defaultNames = [
        "Team 1",
        "Team 2",
        "Team 3",
        "Team 4",
        "Team 5",
        "Team 6",
      ];
      const colors = [
        "#ef4444",
        "#f97316",
        "#eab308",
        "#22c55e",
        "#3b82f6",
        "#a855f7",
      ];
      const existing = await Team.countDocuments({ sessionId });
      if (existing > 0) {
        return NextResponse.json(
          { error: "Teams already exist for this session" },
          { status: 400 },
        );
      }
      const docs = await Team.insertMany(
        defaultNames.map((name, i) => ({
          name,
          color: colors[i],
          sessionId,
          sortOrder: i,
        })),
      );
      const sid = new mongoose.Types.ObjectId(sessionId);
      await syncTeamLoginsForSession(sid);
      const withLogin = await Team.find({
        _id: { $in: docs.map((d) => d._id) },
      })
        .select("-passwordHash")
        .lean();
      return NextResponse.json(withLogin);
    }
    const doc = await Team.create({
      name: String(body.name ?? "Team"),
      color: String(body.color ?? "#6366f1"),
      sessionId,
      sortOrder: Number(body.sortOrder ?? 0),
      loginUsername: body.loginUsername
        ? String(body.loginUsername).trim().toLowerCase()
        : undefined,
    });
    return NextResponse.json(doc);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Bulk update password for all teams in a session. */
export async function PATCH(req: Request) {
  try {
    await dbConnect();
    const body = await req.json();
    const sessionId = String(body.sessionId ?? "");
    const password = String(body.password ?? "");
    if (!sessionId || !mongoose.isValidObjectId(sessionId)) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    }
    if (!password || password.length < 3) {
      return NextResponse.json(
        { error: "Password must be at least 3 characters" },
        { status: 400 },
      );
    }
    const hashed = await hashPassword(password);
    const res = await Team.updateMany(
      { sessionId: new mongoose.Types.ObjectId(sessionId) },
      { $set: { passwordHash: hashed } },
    );
    return NextResponse.json({
      ok: true,
      updated: res.modifiedCount,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
