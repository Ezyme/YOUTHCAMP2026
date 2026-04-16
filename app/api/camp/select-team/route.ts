import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { CAMP_TEAM_COOKIE } from "@/lib/camp/auth";
import mongoose from "mongoose";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const teamId = String(body.teamId ?? "");
  if (!mongoose.isValidObjectId(teamId)) {
    return NextResponse.json({ error: "Invalid team" }, { status: 400 });
  }
  const jar = await cookies();
  jar.set(CAMP_TEAM_COOKIE, teamId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
  return NextResponse.json({ ok: true });
}
