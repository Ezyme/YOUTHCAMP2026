import Link from "next/link";
import { notFound } from "next/navigation";
import { dbConnect } from "@/lib/db/connect";
import {
  requireCampTeamForGameRoute,
  teamHasGameResult,
} from "@/lib/camp/team-game-access";
import { GameDefinition } from "@/lib/db/models";
import { ENGINE_LABELS } from "@/lib/games/registry";

type Props = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

export default async function GameDetailPage({ params }: Props) {
  const { slug } = await params;
  await dbConnect();
  const g = await GameDefinition.findOne({ slug }).lean();
  if (!g) notFound();
  if (g.day === 0) notFound();

  if (!g.isPlayable) {
    const { sessionId, teamId } = await requireCampTeamForGameRoute(
      `/games/${slug}`,
    );
    const allowed = await teamHasGameResult(sessionId, teamId, String(g._id));
    if (!allowed) notFound();
  } else {
    await requireCampTeamForGameRoute(`/games/${slug}`);
  }

  const pts = g.scoring?.placementPoints ?? [];
  const playHref = g.isPlayable ? `/play/${g.slug}` : null;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Day {g.day} · {g.category}
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
        {g.name}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {ENGINE_LABELS[g.engineKey]}
      </p>

      <div className="ui-card mt-6 rounded-2xl p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-card-foreground">
          {g.scoring?.scoringMode === "manual_points"
            ? "Manual scoring (per team)"
            : "Published points (1st → 6th)"}
        </h2>
        {g.scoring?.scoringMode === "manual_points" ? (
          <p className="mt-2 text-sm text-foreground">
            Enter each team&apos;s weighted score in Admin → Scoring (0–
            {g.scoring?.manualPointsMax ?? 10} toward the /100 camp total).
            Placement row below is not used for this category.
          </p>
        ) : (
          <p className="mt-2 font-mono text-sm text-foreground">
            {pts.join(" · ")}
          </p>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          Mode:{" "}
          {g.scoring?.weight === 0
            ? "Reference only — not added to the in-app leaderboard total."
            : g.scoring?.scoringMode === "manual_points"
              ? "Facilitator enters points per team — not 1st–6th placement."
              : g.scoring?.scoringMode === "amazing_race_first_only"
                ? "Amazing Race — only 1st place earns points from this row."
                : g.scoring?.scoringMode === "amazing_race_finish"
                  ? "Amazing Race — rank by finish order, then map to this row."
                  : "Placement — facilitator enters 1st–6th after the game."}
          {g.scoring?.weight != null &&
            g.scoring.weight !== 1 &&
            g.scoring.weight !== 0 && <> Weight: ×{g.scoring.weight}</>}
        </p>
      </div>

      {g.rulesMarkdown ? (
        <article className="prose prose-zinc mt-6 max-w-none text-sm dark:prose-invert">
          <pre className="whitespace-pre-wrap rounded-xl bg-muted p-4 font-sans text-foreground">
            {g.rulesMarkdown}
          </pre>
        </article>
      ) : null}

      <div className="mt-8 flex flex-wrap gap-3">
        {playHref ? (
          <Link
            href={playHref}
            className="ui-button rounded-xl px-5 py-2.5 text-sm font-medium"
          >
            Play in app
          </Link>
        ) : (
          <span className="ui-button-secondary rounded-xl px-5 py-2.5 text-sm text-muted-foreground">
            In-app play coming soon for this game type
          </span>
        )}
        <Link
          href="/games"
          className="ui-button-secondary rounded-xl px-5 py-2.5 text-sm font-medium text-foreground"
        >
          All games
        </Link>
      </div>
    </main>
  );
}
