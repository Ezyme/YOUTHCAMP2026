import Link from "next/link";
import { dbConnect } from "@/lib/db/connect";
import { GameDefinition } from "@/lib/db/models";
import { loadCampTeamScoredGames } from "@/lib/camp/team-game-access";
import { ENGINE_LABELS } from "@/lib/games/registry";
import { ChevronRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function GamesPage() {
  const ctx = await loadCampTeamScoredGames();
  if (ctx.status === "no_session") {
    return (
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Games
        </h1>
        <p className="mt-4 text-sm text-muted-foreground">
          No session — run seed from Admin.
        </p>
        <Link href="/admin" className="mt-4 inline-block text-primary">
          Admin
        </Link>
      </main>
    );
  }

  const { scoredGameIds } = ctx.data;
  await dbConnect();
  const games = await GameDefinition.find().sort({ day: 1, order: 1 }).lean();

  const visible = games.filter(
    (g) => g.day > 0 && scoredGameIds.has(String(g._id)),
  );

  const byDay = [1, 2].map((day) => ({
    day,
    items: visible.filter((g) => g.day === day),
  }));

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Games
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        This list only shows Day 1–2 games after your facilitator has entered a
        score for your team. Live play for Unmasked and Mindgame is always
        available from the home page or your camp dashboard.
      </p>
      {visible.length === 0 ? (
        <div className="mt-8 space-y-4 rounded-2xl border border-border bg-card px-4 py-6 text-sm text-muted-foreground shadow-sm">
          <p>
            No scored games yet. When results are published, those games will
            appear here with links to rules and play.
          </p>
          <p className="text-foreground">
            <span className="font-medium">Play now (no score required):</span>
          </p>
          <ul className="list-inside list-disc space-y-1">
            <li>
              <Link href="/play/unmasked" className="text-primary hover:underline">
                Unmasked
              </Link>
            </li>
            <li>
              <Link href="/play/mindgame" className="text-primary hover:underline">
                Mindgame
              </Link>
            </li>
          </ul>
          <p>
            <Link href="/" className="text-primary hover:underline">
              ← Back to home
            </Link>
          </p>
        </div>
      ) : (
        <div className="mt-8 space-y-10">
          {byDay.map(({ day, items }) => (
            <section key={day}>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Day {day}
              </h2>
              <ul className="mt-3 divide-y divide-border rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
                {items.length === 0 && (
                  <li className="px-4 py-6 text-sm text-muted-foreground">
                    No games on this day.
                  </li>
                )}
                {items.map((g) => {
                const pts = g.scoring?.placementPoints ?? [];
                const playHref = g.isPlayable
                  ? `/play/${g.slug}`
                  : `/games/${g.slug}`;
                return (
                  <li key={String(g._id)}>
                    <Link
                      href={playHref}
                      className="flex items-start gap-3 px-4 py-4 transition hover:bg-muted/60"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-card-foreground">
                            {g.name}
                          </span>
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                            {g.category}
                          </span>
                          {g.isPlayable && (
                            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                              Playable
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {ENGINE_LABELS[g.engineKey]} ·{" "}
                          {g.scoring?.scoringMode === "manual_points"
                            ? `Manual per team (max ${g.scoring?.manualPointsMax ?? 10} toward /100)`
                            : g.scoring?.scoringMode === "amazing_race_first_only"
                              ? "1st place only → 30 pts max"
                              : g.scoring?.scoringMode === "amazing_race_finish"
                                ? "Finish order → points"
                                : g.scoring?.weight === 0
                                  ? "Not in app total (reference)"
                                  : `Points ${pts.join(" / ")}`}
                        </p>
                      </div>
                      <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" />
                    </Link>
                  </li>
                );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
