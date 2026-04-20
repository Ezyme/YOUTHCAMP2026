"use client";

import { useCallback, useEffect, useState } from "react";
import { UnmaskedBoard } from "@/components/games/unmasked/unmasked-board";
import { showError, showSuccess } from "@/lib/ui/toast";
import type { PowerUpType } from "@/lib/db/models";

type TeamSummary =
  | {
      teamId: string;
      teamName: string;
      color: string;
      hasState: false;
    }
  | {
      teamId: string;
      teamName: string;
      color: string;
      hasState: true;
      status: "playing" | "won" | "lost";
      passagesComplete: boolean;
      hearts: number;
      maxHearts: number;
      liesHit: number;
      shielded: boolean;
      gridSize: number;
      totalLies: number;
      totalCells: number;
      revealedCount: number;
      redeemedCodes: string[];
      powerUps: { type: PowerUpType; used: boolean }[];
      startedAt?: Date;
      finishedAt?: Date;
      checkPassagePenaltySeconds: number;
      verseKeys: string[];
      versesRestored: string[];
    };

export function UnmaskedTeamsAdmin({
  sessionId,
  teams,
}: {
  sessionId: string;
  teams: { _id: string; name: string }[];
}) {
  const [rows, setRows] = useState<TeamSummary[]>([]);
  const [selectedId, setSelectedId] = useState(teams[0]?._id ?? "");
  const [boardKey, setBoardKey] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!sessionId) return;
    const res = await fetch(`/api/admin/unmasked/teams?sessionId=${sessionId}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showError(String(data.error ?? "Failed to load team summaries"));
      return;
    }
    const list = Array.isArray(data.teams) ? data.teams : [];
    setRows(list as TeamSummary[]);
    setLoading(false);
  }, [sessionId]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 8000);
    return () => window.clearInterval(id);
  }, [load]);

  const selectedRow = rows.find((r) => r.teamId === selectedId);
  const selectedTeamName = teams.find((t) => t._id === selectedId)?.name ?? "Team";

  async function resetTimer(teamId: string) {
    if (
      !confirm(
        "Reset this team's run timer to now and clear passage-check time penalties? The board and codes are unchanged.",
      )
    ) {
      return;
    }
    const res = await fetch("/api/admin/unmasked/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, teamId, action: "timer" }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showError(String(data.error ?? "Reset failed"));
      return;
    }
    showSuccess("Timer reset");
    setBoardKey((k) => k + 1);
    void load();
  }

  async function resetBoard(teamId: string) {
    if (
      !confirm(
        "Shuffle a new minefield and reset passages for this team? Redeemed Amazing Race codes stay unlocked; power-ups refresh; the run timer is unchanged (same as in-game “New board”).",
      )
    ) {
      return;
    }
    const res = await fetch("/api/admin/unmasked/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, teamId, action: "board", slug: "unmasked" }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showError(String(data.error ?? "Reset failed"));
      return;
    }
    showSuccess("Board progress reset");
    setBoardKey((k) => k + 1);
    void load();
  }

  if (!sessionId) {
    return <p className="mt-4 text-sm text-amber-800">No session — seed the camp first.</p>;
  }

  return (
    <div className="mt-6 space-y-6">
      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-border bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Team</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Timer / penalties</th>
              <th className="px-3 py-2 font-medium">Board</th>
              <th className="px-3 py-2 font-medium">Passages</th>
              <th className="px-3 py-2 font-medium">Codes</th>
              <th className="px-3 py-2 font-medium">Power-ups</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            ) : null}
            {rows.map((r) => {
              const puTotal =
                r.hasState ? r.powerUps.length : 0;
              const puAvail =
                r.hasState ? r.powerUps.filter((p) => !p.used).length : 0;
              return (
                <tr
                  key={r.teamId}
                  className={`border-b border-border/80 ${selectedId === r.teamId ? "bg-primary/5" : ""}`}
                >
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => setSelectedId(r.teamId)}
                      className={`font-medium text-foreground underline-offset-2 hover:underline ${
                        selectedId === r.teamId ? "text-primary" : ""
                      }`}
                    >
                      {r.teamName}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {!r.hasState ?
                      "Not started"
                    : r.passagesComplete ?
                      "Complete"
                    : r.status === "lost" ?
                      "Game over"
                    : r.status === "won" ?
                      "Minefield clear"
                    : "Playing"}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {!r.hasState ?
                      "—"
                    : (
                      <>
                        {r.startedAt ?
                          `Started ${new Date(r.startedAt).toLocaleTimeString()}`
                        : "—"}
                        {r.checkPassagePenaltySeconds > 0 ?
                          ` · +${r.checkPassagePenaltySeconds}s penalties`
                        : ""}
                      </>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {!r.hasState || !r.totalCells ?
                      "—"
                    : `${r.revealedCount}/${r.totalCells} tiles revealed · ${r.totalLies} lies`}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {!r.hasState ?
                      "—"
                    : r.verseKeys.length === 0 ?
                      "—"
                    : `${r.versesRestored.length}/${r.verseKeys.length}`}
                  </td>
                  <td className="px-3 py-2 text-xs font-mono text-muted-foreground">
                    {!r.hasState || r.redeemedCodes.length === 0 ?
                      "—"
                    : r.redeemedCodes.join(", ")}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {!r.hasState ? "—" : `${puAvail} ready / ${puTotal} total`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedId ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-foreground">{selectedTeamName}</h2>
            {selectedRow?.hasState ? (
              <>
                <button
                  type="button"
                  onClick={() => void resetTimer(selectedId)}
                  className="ui-button-secondary rounded-lg px-3 py-1.5 text-xs font-medium"
                >
                  Reset timer
                </button>
                <button
                  type="button"
                  onClick={() => void resetBoard(selectedId)}
                  className="ui-button-secondary rounded-lg px-3 py-1.5 text-xs font-medium"
                >
                  Reset board progress
                </button>
              </>
            ) : (
              <span className="text-xs text-muted-foreground">
                No saved game yet — the team must open Unmasked once before you can reset or view the board.
              </span>
            )}
          </div>

          {selectedRow?.hasState ? (
            <UnmaskedBoard
              key={`${selectedId}-${boardKey}`}
              sessionId={sessionId}
              teamId={selectedId}
              groupLabel={selectedTeamName}
              gameSlug="unmasked"
              readOnly
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Open the game as this team on a device to create their first board; then refresh this page.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
