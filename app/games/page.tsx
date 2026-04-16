import Link from "next/link";
import { dbConnect } from "@/lib/db/connect";
import { GameDefinition } from "@/lib/db/models";
import { ENGINE_LABELS } from "@/lib/games/registry";
import { ChevronRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function GamesPage() {
  await dbConnect();
  const games = await GameDefinition.find().sort({ day: 1, order: 1 }).lean();

  const byDay = [0, 1, 2].map((day) => ({
    day,
    items: games.filter((g) => g.day === day),
  }));

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Games
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Each game shows its published scoring row. Playable entries open the in-app
        experience; others show rules and setup until you add an engine.
      </p>
      <div className="mt-8 space-y-10">
        {byDay.map(({ day, items }) => (
          <section key={day}>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Day {day}
            </h2>
            <ul className="mt-3 divide-y divide-border rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
              {items.length === 0 && (
                <li className="px-4 py-6 text-sm text-muted-foreground">
                  No games yet. Run seed from Admin.
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
                          {g.scoring?.scoringMode === "amazing_race_finish"
                            ? "Finish order → points"
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
    </main>
  );
}
