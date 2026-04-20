import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db/connect";
import { GameDefinition, Session, Team } from "@/lib/db/models";
import { CAMP_GAMES, scoringForSeed } from "@/lib/seed/camp-games";
import { syncTeamLoginsForSession } from "@/lib/seed/sync-team-logins";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const admin = process.env.ADMIN_SECRET;
  if (admin) {
    const header = req.headers.get("x-admin-secret");
    if (header !== admin && body.secret !== admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    await dbConnect();
    let createdGames = 0;
    for (const g of CAMP_GAMES) {
      const scoring = scoringForSeed(g);
      const $set: Record<string, unknown> = {
        name: g.name,
        slug: g.slug,
        day: g.day,
        category: g.category,
        engineKey: g.engineKey,
        isPlayable: g.isPlayable,
        order: g.order,
        scoring,
        rulesMarkdown: g.rulesMarkdown ?? "",
      };
      if (g.settings !== undefined) {
        $set.settings = g.settings;
      }
      const res = await GameDefinition.findOneAndUpdate(
        { slug: g.slug },
        { $set },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      if (res) createdGames++;
    }

    let session = await Session.findOne({ active: true });
    if (!session) {
      session = await Session.create({ label: "Youth Camp 2026", active: true });
    }
    const teamCount = await Team.countDocuments({ sessionId: session._id });
    if (teamCount === 0) {
      await Team.insertMany(
        ["Team 1", "Team 2", "Team 3", "Team 4", "Team 5", "Team 6"].map(
          (name, i) => ({
            name,
            color: ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#a855f7"][i],
            sessionId: session._id,
            sortOrder: i,
          }),
        ),
      );
    }

    const { usernames } = await syncTeamLoginsForSession(session._id);

    return NextResponse.json({
      ok: true,
      gamesUpserted: createdGames,
      sessionId: String(session._id),
      teamLoginUsernames: usernames,
      teamPasswordNote:
        "All teams share the password from TEAM_SEED_PASSWORD (default: youthcamp). Usernames: team1 … team6.",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
