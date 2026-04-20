import { ScoringPanel } from "@/components/admin/scoring-panel";
import { plainGameScoring } from "@/lib/admin/plain-game-scoring";
import { dbConnect } from "@/lib/db/connect";
import { GameDefinition, Session, Team } from "@/lib/db/models";

export const dynamic = "force-dynamic";

export default async function ScoringPage() {
  await dbConnect();
  const session = await Session.findOne().sort({ createdAt: -1 });
  const sessionId = session ? String(session._id) : "";
  const teams = session
    ? await Team.find({ sessionId: session._id }).sort({ sortOrder: 1 }).lean()
    : [];
  const games = await GameDefinition.find().sort({ day: 1, order: 1 }).lean();

  const gamesForClient = games.map((g) => ({
    _id: String(g._id),
    name: g.name,
    slug: g.slug,
    scoring: plainGameScoring(g.scoring),
  }));

  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground">Scoring</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        /100 rubric: merit 5%, team mini-games 25% combined, Amazing Race 30%,
        flag 10%, cheer 10%, group skit 20%. Pool/field games use placement;
        merit and Camper&apos;s Night use per-team scores. See each game&apos;s
        rules for rows and notes.
      </p>
      <div className="mt-6">
        <ScoringPanel
          sessionId={sessionId}
          games={gamesForClient}
          teams={teams.map((t) => ({
            _id: String(t._id),
            name: t.name,
          }))}
        />
      </div>
    </div>
  );
}
