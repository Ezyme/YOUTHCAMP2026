import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { dbConnect } from "@/lib/db/connect";
import { CAMP_TEAM_COOKIE } from "@/lib/camp/auth";
import { GameDefinition, Session, Team } from "@/lib/db/models";
import { MindgameBoard } from "@/components/games/mindgame/mindgame-board";
import { UnmaskedBoard } from "@/components/games/unmasked/unmasked-board";
import mongoose from "mongoose";
import { ensureGameDefinitionBySlug } from "@/lib/seed/ensure-game-definition";

type Props = {
  params: Promise<{ gameSlug: string }>;
  searchParams: Promise<{ teamId?: string }>;
};

export const dynamic = "force-dynamic";

export default async function PlayGamePage({ params, searchParams }: Props) {
  const { gameSlug } = await params;
  const q = await searchParams;
  await dbConnect();
  let game = await GameDefinition.findOne({ slug: gameSlug }).lean();
  if (!game) {
    await ensureGameDefinitionBySlug(gameSlug);
    game = await GameDefinition.findOne({ slug: gameSlug }).lean();
  }
  if (!game) notFound();

  const session = await Session.findOne().sort({ createdAt: -1 });
  const sessionId = session ? String(session._id) : "";
  const jar = await cookies();
  const cookieTeam = jar.get(CAMP_TEAM_COOKIE)?.value;

  let defaultTeamId = q.teamId ?? "";
  if (!defaultTeamId && cookieTeam && mongoose.isValidObjectId(cookieTeam)) {
    defaultTeamId = cookieTeam;
  }

  if (!defaultTeamId) {
    redirect(`/login?next=/play/${gameSlug}`);
  }

  let mindgameGroupLabel = "";
  let playTeamName = "";
  if (defaultTeamId && mongoose.isValidObjectId(defaultTeamId)) {
    const tdoc = await Team.findById(defaultTeamId).lean();
    if (tdoc) {
      mindgameGroupLabel = tdoc.name;
      playTeamName = tdoc.name;
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Play · Day {game.day}
      </p>
      <h1 className="mt-2 text-2xl font-semibold text-foreground">{game.name}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {game.rulesMarkdown?.slice(0, 200)}
        {game.rulesMarkdown && game.rulesMarkdown.length > 200 ? "…" : ""}
      </p>

      <div className="mt-8">
        {game.engineKey === "mindgame" ? (
          <MindgameBoard
            sessionId={sessionId || undefined}
            teamId={defaultTeamId || undefined}
            groupLabel={mindgameGroupLabel || undefined}
          />
        ) : game.engineKey === "unmasked" ? (
          <UnmaskedBoard
            sessionId={sessionId}
            teamId={defaultTeamId}
            groupLabel={playTeamName || undefined}
            gameSlug={game.slug}
          />
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-card/50 p-6 text-sm text-muted-foreground">
            This game is not playable in-app yet. See rules on the{" "}
            <Link href={`/games/${game.slug}`} className="text-primary hover:underline">
              game page
            </Link>
            .
          </div>
        )}
      </div>

      <div className="mt-10 text-sm">
        <Link href="/games" className="text-primary hover:underline">
          ← All games
        </Link>
      </div>
    </main>
  );
}
