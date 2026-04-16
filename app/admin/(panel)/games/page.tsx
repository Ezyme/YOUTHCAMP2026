import Link from "next/link";
import { dbConnect } from "@/lib/db/connect";
import { GameDefinition } from "@/lib/db/models";

export const dynamic = "force-dynamic";

export default async function AdminGamesPage() {
  await dbConnect();
  const games = await GameDefinition.find().sort({ day: 1, order: 1 }).lean();

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Games</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Edit mechanics, engines, and published point rows.
          </p>
        </div>
        <Link
          href="/admin/games/new"
          className="ui-button-secondary rounded-xl px-4 py-2 text-sm font-medium text-foreground"
        >
          New game
        </Link>
      </div>
      <ul className="mt-6 divide-y divide-border rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
        {games.map((g) => (
          <li
            key={String(g._id)}
            className="flex items-center justify-between gap-3 px-4 py-3"
          >
            <div className="min-w-0">
              <p className="font-medium text-card-foreground">{g.name}</p>
              <p className="text-xs text-muted-foreground">
                {g.slug} · day {g.day} · {g.engineKey}
              </p>
            </div>
            <Link
              href={`/admin/games/${String(g._id)}/edit`}
              className="ui-button shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium"
            >
              Edit
            </Link>
          </li>
        ))}
        {games.length === 0 && (
          <li className="px-4 py-8 text-sm text-muted-foreground">
            No games. Run seed.
          </li>
        )}
      </ul>
    </div>
  );
}
