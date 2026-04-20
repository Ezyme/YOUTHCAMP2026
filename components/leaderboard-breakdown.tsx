import { getTeamBreakdown } from "@/lib/scoring/totals";
import type { LeaderboardRow, ScoreBreakdownRow } from "@/lib/scoring/totals";

function ordinal(n: number): string {
  const j = n % 10;
  const k = n % 100;
  if (k === 11 || k === 12 || k === 13) return `${n}th`;
  if (j === 1) return `${n}st`;
  if (j === 2) return `${n}nd`;
  if (j === 3) return `${n}rd`;
  return `${n}th`;
}

function formatPts(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2);
}

function formatWeightPct(weight: number): string {
  if (Math.abs(weight - 1) < 1e-9) return "100%";
  return `${(weight * 100).toFixed(1)}%`;
}

function placementScaleLegend(row: number[]): string {
  return row.map((p, i) => `${ordinal(i + 1)} ${p}`).join(" · ");
}

function BreakdownRowDetail({ b }: { b: ScoreBreakdownRow }) {
  if (b.scoringMode === "manual_points") {
    const max = b.manualPointsMax;
    const maxPart =
      max != null ? ` (max ${max} on the /100 camp total)` : "";
    return (
      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
        <span className="text-foreground">
          {formatPts(b.pointsAwarded)} pts
        </span>{" "}
        from judges{maxPart}. Sorted by score, this team is{" "}
        <span className="whitespace-nowrap">{ordinal(b.placement)}</span> — that
        rank is for ordering only; points are not computed from the 1st–6th
        placement scale (that math is for race finishes).
      </p>
    );
  }

  const base = b.basePlacementPoints;
  const w = b.weight;
  const pct = formatWeightPct(w);

  return (
    <>
      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
        <span className="text-foreground">{ordinal(b.placement)} place</span>
        : base value{" "}
        <span className="font-mono tabular-nums text-foreground">
          {base != null ? base : "—"}
        </span>{" "}
        × event weight{" "}
        <span
          className="whitespace-nowrap font-mono tabular-nums text-foreground"
          title={`Multiplier toward /100 camp total: ${w}`}
        >
          {pct}
        </span>{" "}
        →{" "}
        <span className="font-semibold text-foreground">
          {formatPts(b.pointsAwarded)} pts
        </span>{" "}
        on the camp total
      </p>
      <p className="mt-1 text-[11px] leading-snug text-muted-foreground/90">
        Scale 1st→6th: {placementScaleLegend(b.placementPointsRow)}
      </p>
    </>
  );
}

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
          <>
            <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
              <strong className="font-medium text-foreground">
                How to read this:
              </strong>{" "}
              For races, camp points ={" "}
              <span className="whitespace-nowrap">
                base for your place × event weight
              </span>{" "}
              toward the /100 total. For Flag, Cheer, Presentation, and Merit,
              judges enter points (capped per category); placement is rank by
              score only.
            </p>
            <ul className="space-y-4">
              {breakdown.map((b) => (
                <li
                  key={b.gameId}
                  className="rounded-xl border border-border/80 bg-muted/30 px-3 py-2.5"
                >
                  <div className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Day {b.day}
                        {b.category ? (
                          <span className="font-normal normal-case">
                            {" "}
                            · {b.category}
                          </span>
                        ) : null}
                      </p>
                      <p className="text-sm font-medium text-foreground">
                        {b.gameName}
                      </p>
                    </div>
                    <p className="shrink-0 text-right font-mono text-sm font-semibold tabular-nums text-foreground sm:pt-5">
                      +{formatPts(b.pointsAwarded)} pts
                    </p>
                  </div>
                  <BreakdownRowDetail b={b} />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </details>
  );
}
