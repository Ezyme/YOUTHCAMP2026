import { CluesAdmin } from "@/components/admin/clues-admin";
import { dbConnect } from "@/lib/db/connect";
import { GameDefinition, Session, Team } from "@/lib/db/models";

export const dynamic = "force-dynamic";

export default async function CluesPage() {
  await dbConnect();
  const session = await Session.findOne().sort({ createdAt: -1 });
  const sessionId = session ? String(session._id) : "";
  const teams = session
    ? await Team.find({ sessionId: session._id }).sort({ sortOrder: 1 }).lean()
    : [];
  const games = await GameDefinition.find().sort({ day: 1, order: 1 }).lean();
  const gameSlugs = games.map((g) => g.slug);

  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground">Clues</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Attach clues to teams for Amazing Race stations (by game slug).
      </p>
      <div className="mt-6">
        <CluesAdmin
          sessionId={sessionId}
          teams={teams.map((t) => ({ _id: String(t._id), name: t.name }))}
          gameSlugs={gameSlugs.length ? gameSlugs : ["amazing-race"]}
        />
      </div>
    </div>
  );
}
