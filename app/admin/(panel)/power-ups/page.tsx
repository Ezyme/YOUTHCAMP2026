import { PowerUpsAdmin } from "@/components/admin/power-ups-admin";
import { dbConnect } from "@/lib/db/connect";
import { Session, Team } from "@/lib/db/models";

export const dynamic = "force-dynamic";

export default async function PowerUpsPage() {
  await dbConnect();
  const session = await Session.findOne().sort({ createdAt: -1 });
  let teams: { _id: string; name: string }[] = [];
  let sessionId = "";
  if (session) {
    sessionId = String(session._id);
    const t = await Team.find({ sessionId: session._id })
      .sort({ sortOrder: 1 })
      .lean();
    teams = t.map((x) => ({ _id: String(x._id), name: x.name }));
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground">Power-Up Codes</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Create codes that teams enter during the Unmasked game to unlock special
        abilities. Hand these out at Amazing Race stations.
      </p>
      <PowerUpsAdmin sessionId={sessionId} teams={teams} />
    </div>
  );
}
