import { getTeamBreakdown } from "@/lib/scoring/totals";
import type { LeaderboardRow } from "@/lib/scoring/totals";

export async function LeaderboardBreakdown({
  rank,
  row,
  sessionId,
}: {
  rank: number;
  row: LeaderboardRow;
  sessionId: string;
}) {
  const breakdown = await getTeamBreakdown(sessionId, row.teamId);

  return (
    <details className="ui-card group rounded-2xl">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3">
        <span className="flex size-8 items-center justify-center rounded-full bg-muted text-sm font-semibold text-foreground">
          {rank}
        </span>
        <span
          className="size-3 rounded-full"
          style={{ backgroundColor: row.color }}
        />
        <span className="flex-1 font-medium text-foreground">
          {row.teamName}
        </span>
        <span className="font-mono text-sm">{row.totalPoints} pts</span>
        <span className="text-xs text-muted-foreground">
          {row.behindLeader === 0 ? "Leader" : `−${row.behindLeader}`}
        </span>
      </summary>
      <div className="border-t border-border px-4 py-3 text-sm">
        {breakdown.length === 0 ? (
          <p className="text-xs text-muted-foreground">No recorded games yet.</p>
        ) : (
          <ul className="space-y-2">
            {breakdown.map((b) => (
              <li
                key={b.gameId}
                className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground"
              >
                <span>
                  Day {b.day} · {b.gameName}
                </span>
                <span>
                  place {b.placement} → {b.pointsAwarded} pts (row{" "}
                  {b.placementPointsRow.join("/")}, ×{b.weight})
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
