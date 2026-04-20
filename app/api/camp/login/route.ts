import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { CAMP_AUTH_COOKIE, CAMP_TEAM_COOKIE, isCampGateEnabled } from "@/lib/camp/auth";
import { verifyPassword } from "@/lib/camp/password";
import { dbConnect } from "@/lib/db/connect";
import { Session, Team } from "@/lib/db/models";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const username = String(body.username ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  if (isCampGateEnabled()) {
    const jarEarly = await cookies();
    if (jarEarly.get(CAMP_AUTH_COOKIE)?.value === "1") {
      return NextResponse.json({
        ok: true,
        alreadyAuthenticated: true,
      });
    }
  }

  if (!isCampGateEnabled()) {
    const jar = await cookies();
    jar.set(CAMP_AUTH_COOKIE, "1", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 14,
    });
    return NextResponse.json({
      ok: true,
      message: "Camp gate off — run seed and set CAMP_REQUIRE_LOGIN=1 to require team logins",
    });
  }

  if (!username || !password) {
    return NextResponse.json(
      { error: "Username and password required" },
      { status: 400 },
    );
  }

  try {
    await dbConnect();
    const session = await Session.findOne().sort({ createdAt: -1 });
    if (!session) {
      return NextResponse.json({ error: "No camp session" }, { status: 404 });
    }

    const team = await Team.findOne({
      sessionId: session._id,
      loginUsername: username,
    }).select("+passwordHash");

    if (!team?.passwordHash) {
      return NextResponse.json(
        { error: "Unknown user — run seed to create team1…team6 accounts" },
        { status: 401 },
      );
    }

    const ok = await verifyPassword(password, team.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const jar = await cookies();
    jar.set(CAMP_AUTH_COOKIE, "1", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 14,
    });
    jar.set(CAMP_TEAM_COOKIE, String(team._id), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 14,
    });

    return NextResponse.json({
      ok: true,
      teamId: String(team._id),
      teamName: team.name,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
