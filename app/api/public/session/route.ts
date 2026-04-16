import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db/connect";
import { Session, Team } from "@/lib/db/models";

/** Public session + team list for camp login / dashboard pickers (no secrets). */
export async function GET() {
  try {
    await dbConnect();
    const session = await Session.findOne().sort({ createdAt: -1 }).lean();
    if (!session) {
      return NextResponse.json({ session: null, teams: [] });
    }
    const teams = await Team.find({ sessionId: session._id })
      .sort({ sortOrder: 1, name: 1 })
      .lean();
    return NextResponse.json({
      session: {
        id: String(session._id),
        label: session.label,
      },
      teams: teams.map((t) => ({
        id: String(t._id),
        name: t.name,
        color: t.color,
        loginUsername: t.loginUsername ?? null,
      })),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
