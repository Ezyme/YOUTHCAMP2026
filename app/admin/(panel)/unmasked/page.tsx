import { UnmaskedTeamsAdmin } from "@/components/admin/unmasked-teams-admin";
import { dbConnect } from "@/lib/db/connect";
import { Session, Team } from "@/lib/db/models";

export const dynamic = "force-dynamic";

export default async function AdminUnmaskedPage() {
  await dbConnect();
  const session = await Session.findOne().sort({ createdAt: -1 });
  let teams: { _id: string; name: string }[] = [];
  let sessionId = "";
  if (session) {
    sessionId = String(session._id);
    const t = await Team.find({ sessionId: session._id }).sort({ sortOrder: 1 }).lean();
    teams = t.map((x) => ({ _id: String(x._id), name: x.name }));
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground">Unmasked — teams</h1>
      <p className="mt-1 max-w-prose text-sm text-muted-foreground">
        Watch each team&apos;s board, timer, redeemed codes, and power-up inventory. Reset a team&apos;s timer or
        shuffle a new minefield (same rules as the in-game &quot;New board&quot; — codes stay redeemed; timer
        unchanged unless you reset it here).
      </p>
      <UnmaskedTeamsAdmin sessionId={sessionId} teams={teams} />
    </div>
  );
}
