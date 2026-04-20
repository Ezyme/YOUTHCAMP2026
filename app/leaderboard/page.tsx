import Link from "next/link";
import { dbConnect } from "@/lib/db/connect";
import { Session } from "@/lib/db/models";
import { getLeaderboard } from "@/lib/scoring/totals";
import { LeaderboardBreakdown } from "@/components/leaderboard-breakdown";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  await dbConnect();
  const session = await Session.findOne().sort({ createdAt: -1 });
  if (!session) {
    return (
      <main className="mx-auto max-w-3xl flex-1 px-4 py-10">
        <p className="text-sm text-muted-foreground">
          No session yet. Run seed from Admin.
        </p>
        <Link href="/admin" className="mt-4 inline-block text-sm text-primary">
          Go to admin
        </Link>
      </main>
    );
  }
  const sessionId = String(session._id);
  const rows = await getLeaderboard(sessionId);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Leaderboard
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Session: {session.label}. Totals follow the /100 rubric: merit 5%, team
        games 25%, Amazing Race 30%, flag 10%, cheer 10%, group skit 20%. Expand
        a team for the breakdown.
      </p>
      <ol className="mt-6 space-y-3">
        {rows.map((r, i) => (
          <li key={r.teamId}>
            <LeaderboardBreakdown
              rank={i + 1}
              row={r}
              sessionId={sessionId}
            />
          </li>
        ))}
      </ol>
      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">No teams yet.</p>
      ) : null}
    </main>
  );
}
