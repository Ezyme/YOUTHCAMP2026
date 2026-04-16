import { TeamsClient } from "@/components/admin/teams-client";
import { dbConnect } from "@/lib/db/connect";
import { Session, Team } from "@/lib/db/models";

export const dynamic = "force-dynamic";

export default async function TeamsPage() {
  await dbConnect();
  const session = await Session.findOne().sort({ createdAt: -1 });
  let teams: { _id: string; name: string; color: string; loginUsername?: string }[] = [];
  let sessionId = "";
  if (session) {
    sessionId = String(session._id);
    const t = await Team.find({ sessionId: session._id })
      .sort({ sortOrder: 1 })
      .lean();
    teams = t.map((x) => ({
      _id: String(x._id),
      name: x.name,
      color: x.color,
      loginUsername: x.loginUsername ?? undefined,
    }));
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground">Teams</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Manage teams, set usernames and the shared login password.
      </p>
      <TeamsClient sessionId={sessionId} initialTeams={teams} />
    </div>
  );
}
