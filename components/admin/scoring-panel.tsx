"use client";

import { useEffect, useMemo, useState } from "react";
import { pointsForPlacement } from "@/lib/scoring/points";
import type { GameScoring } from "@/lib/db/models";

type Game = {
  _id: string;
  name: string;
  slug: string;
  scoring: GameScoring;
  scoringMode?: string;
};

type Team = { _id: string; name: string };

export function ScoringPanel({
  sessionId,
  games,
  teams,
}: {
  sessionId: string;
  games: Game[];
  teams: Team[];
}) {
  const [gameId, setGameId] = useState(games[0]?._id ?? "");
  const [placements, setPlacements] = useState<Record<string, number>>({});
  const [msg, setMsg] = useState("");
  const [existing, setExisting] = useState<Record<string, number>>({});

  const game = useMemo(
    () => games.find((g) => g._id === gameId),
    [games, gameId],
  );

  useEffect(() => {
    if (!sessionId || !gameId) return;
    let cancelled = false;
    (async () => {
      const res = await fetch(
        `/api/game-results?sessionId=${sessionId}&gameId=${gameId}`,
      );
      const rows = await res.json();
      if (cancelled || !Array.isArray(rows)) return;
      const next: Record<string, number> = {};
      for (const r of rows) {
        next[String(r.teamId)] = r.placement;
      }
      setExisting(next);
      setPlacements(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, gameId]);

  function setPlacement(teamId: string, p: number) {
    setPlacements((prev) => ({ ...prev, [teamId]: p }));
  }

  async function save() {
    setMsg("");
    if (!game) return;
    const results = teams.map((t) => ({
      teamId: t._id,
      placement: placements[t._id] ?? 0,
    }));
    const res = await fetch("/api/game-results", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, gameId, results }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error ?? "Save failed");
      return;
    }
    setMsg("Saved.");
  }

  if (!sessionId) {
    return (
      <p className="text-sm text-amber-700 dark:text-amber-400">
        No session id. Seed or create a session.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <label className="block text-sm">
        <span className="text-muted-foreground">Game</span>
        <select
          className="ui-field mt-1 w-full max-w-md rounded-lg px-3 py-2 text-sm"
          value={gameId}
          onChange={(e) => setGameId(e.target.value)}
        >
          {games.map((g) => (
            <option key={g._id} value={g._id}>
              {g.name} ({g.scoring?.scoringMode})
            </option>
          ))}
        </select>
      </label>

      {game ? (
        <p className="text-xs text-muted-foreground">
          Published row: {(game.scoring?.placementPoints ?? []).join(" · ")} ·
          weight ×{game.scoring?.weight ?? 1}
          {game.scoring?.scoringMode === "amazing_race_finish"
            ? " · Enter placements 1–6 = finish order (1st to finish = 1)."
            : ""}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="min-w-full text-left text-sm text-foreground">
          <thead className="bg-muted text-foreground">
            <tr>
              <th className="px-3 py-2">Team</th>
              <th className="px-3 py-2">Placement (1–6)</th>
              <th className="px-3 py-2">Points preview</th>
              <th className="px-3 py-2">Saved</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((t) => {
              const p = placements[t._id] ?? 0;
              const pts =
                game && p >= 1 && p <= 6
                  ? pointsForPlacement(game.scoring, p)
                  : "—";
              return (
                <tr key={t._id} className="border-t border-border">
                  <td className="px-3 py-2">{t.name}</td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={1}
                      max={6}
                      className="ui-field w-20 rounded px-2 py-1 text-sm"
                      value={p || ""}
                      placeholder="—"
                      onChange={(e) =>
                        setPlacement(t._id, Number(e.target.value))
                      }
                    />
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{pts}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {existing[t._id] ?? "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={save}
        className="ui-button rounded-xl px-4 py-2 text-sm"
      >
        Save results (validates 1–6 permutation)
      </button>
      {msg ? <p className="text-xs text-muted-foreground">{msg}</p> : null}
    </div>
  );
}
