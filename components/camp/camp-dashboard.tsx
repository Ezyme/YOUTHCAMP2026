"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ComebackAnalytics } from "@/lib/scoring/comeback.types";
import { estimateAvgPlacementToClose } from "@/lib/scoring/estimate-placement";

type TeamOpt = { id: string; name: string; color: string };

export function CampDashboard({
  sessionId,
  initialTeamId,
  teams,
  initialAnalytics,
}: {
  sessionId: string;
  initialTeamId: string;
  teams: TeamOpt[];
  initialAnalytics: ComebackAnalytics | null;
}) {
  const router = useRouter();
  const [teamId, setTeamId] = useState(initialTeamId);
  const [analytics, setAnalytics] = useState<ComebackAnalytics | null>(
    initialAnalytics,
  );
  const [loading, setLoading] = useState(false);

  async function selectTeam(id: string) {
    setLoading(true);
    setTeamId(id);
    await fetch("/api/camp/select-team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamId: id }),
    });
    const res = await fetch(
      `/api/camp/analytics?sessionId=${sessionId}&teamId=${id}`,
    );
    const data = await res.json();
    if (res.ok) setAnalytics(data as ComebackAnalytics);
    setLoading(false);
    router.refresh();
  }

  const openGames = analytics?.games.filter((g) => !g.completed) ?? [];
  const avgToNext =
    analytics?.teamAbove && openGames.length
      ? estimateAvgPlacementToClose(
          analytics.teamAbove.gapPoints,
          openGames,
        )
      : "—";

  return (
    <div className="space-y-8">
      <section className="ui-card rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-foreground">
          Your group
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Pick a team to see comeback stats and open the shared Mindgame board.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <select
            value={teamId}
            onChange={(e) => void selectTeam(e.target.value)}
            disabled={loading || !teams.length}
            className="ui-field rounded-xl px-3 py-2 text-sm"
          >
            {!teams.length ? (
              <option value="">No teams — run seed</option>
            ) : (
              teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))
            )}
          </select>
          {teamId ? (
            <Link
              href={`/play/mindgame?teamId=${teamId}`}
              className="ui-button rounded-xl px-4 py-2 text-sm font-medium"
            >
              Open Mindgame (group)
            </Link>
          ) : null}
        </div>
      </section>

      {!analytics ? (
        <p className="text-sm text-muted-foreground">
          Select a team to load analytics.
        </p>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2">
            <div className="ui-card rounded-2xl p-4">
              <p className="text-xs font-medium uppercase text-muted-foreground">
                Standing
              </p>
              <p className="mt-1 text-2xl font-semibold text-foreground">
                #{analytics.rank} of {analytics.totalTeams}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {analytics.teamName}:{" "}
                <span className="font-mono">{analytics.currentPoints}</span> pts
              </p>
            </div>
            <div className="ui-card rounded-2xl p-4">
              <p className="text-xs font-medium uppercase text-muted-foreground">
                Gap to leader
              </p>
              <p className="mt-1 text-2xl font-semibold text-foreground">
                −{analytics.gapToLeader}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Leader has {analytics.leaderPoints} pts
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-900 dark:bg-amber-950/40">
            <h3 className="text-sm font-semibold text-amber-950 dark:text-amber-100">
              Comeback outlook
            </h3>
            <p className="mt-2 text-sm text-amber-950/90 dark:text-amber-100/90">
              {analytics.comebackStillPossible}
            </p>
            <ul className="mt-3 space-y-1 text-xs text-amber-950/85 dark:text-amber-100/85">
              <li>
                Max you can still earn (1st in every remaining game):{" "}
                <span className="font-mono">{analytics.sumMaxRemaining}</span>
              </li>
              <li>
                Your best possible total:{" "}
                <span className="font-mono">
                  {analytics.yourBestPossibleTotal}
                </span>
              </li>
              <li>
                Leader floor if they place last in all remaining:{" "}
                <span className="font-mono">
                  {analytics.leaderPessimisticTotal}
                </span>
              </li>
            </ul>
          </section>

          <section className="ui-card rounded-2xl p-4">
            <h3 className="text-sm font-semibold text-foreground">
              Targets
            </h3>
            <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
              {analytics.teamAbove ? (
                <li>
                  To pass <strong>{analytics.teamAbove.name}</strong>: need about{" "}
                  <span className="font-mono">
                    {analytics.pointsToPassNext ?? "—"}
                  </span>{" "}
                  more pts (rough +1 over their lead).
                </li>
              ) : (
                <li>You’re in first — hold the lead.</li>
              )}
              <li>
                Rough avg. placement needed on remaining games to close the gap
                to the team above: <span className="font-mono">{avgToNext}</span>
              </li>
              {analytics.pointsToEscapeLast != null ? (
                <li className="text-amber-800 dark:text-amber-200">
                  To avoid last place: gain at least{" "}
                  <span className="font-mono">
                    {analytics.pointsToEscapeLast}
                  </span>{" "}
                  pts vs the team ahead of you.
                </li>
              ) : null}
            </ul>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-foreground">
              Games (weighted) — max per game & your result
            </h3>
            <div className="mt-3 overflow-x-auto rounded-xl border border-border bg-card">
              <table className="min-w-full text-left text-xs text-foreground">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-3 py-2">Game</th>
                    <th className="px-3 py-2">Wt</th>
                    <th className="px-3 py-2">Max / min</th>
                    <th className="px-3 py-2">Yours</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.games.map((g) => (
                    <tr
                      key={g.gameId}
                      className="border-t border-border"
                    >
                      <td className="px-3 py-2">
                        <span className="font-medium">{g.gameName}</span>
                        <span className="ml-1 text-muted-foreground">d{g.day}</span>
                      </td>
                      <td className="px-3 py-2 font-mono">{g.weight}×</td>
                      <td className="px-3 py-2 font-mono">
                        {g.maxPointsThisGame}/{g.minPointsThisGame}
                      </td>
                      <td className="px-3 py-2 font-mono">
                        {g.yourPoints != null
                          ? `${g.yourPoints} (P${g.yourPlacement})`
                          : "—"}
                      </td>
                      <td className="px-3 py-2">
                        {g.completed ? (
                          <span className="text-emerald-600">Done</span>
                        ) : (
                          <span className="text-amber-600">Open</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              “Max” is 1st-place points for that game (after weight). Amazing
              Race uses higher weight so it swings standings more.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
