"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { clampManualPoints, pointsForPlacement } from "@/lib/scoring/points";
import type { GameScoring } from "@/lib/db/models";
import { showError, showSuccess } from "@/lib/ui/toast";

type Game = {
  _id: string;
  name: string;
  slug: string;
  scoring: GameScoring;
};

type Team = { _id: string; name: string };

function ordinal(n: number): string {
  const j = n % 10;
  const k = n % 100;
  if (j === 1 && k !== 11) return `${n}st`;
  if (j === 2 && k !== 12) return `${n}nd`;
  if (j === 3 && k !== 13) return `${n}rd`;
  return `${n}th`;
}

function fillPlacesAfterFirst(
  winnerId: string,
  teamList: Team[],
): Record<string, number> {
  const next: Record<string, number> = {};
  const rest = teamList.filter((t) => t._id !== winnerId);
  next[winnerId] = 1;
  let p = 2;
  for (const t of rest) {
    next[t._id] = p++;
  }
  return next;
}

export function ScoringPanel({
  sessionId,
  games,
  teams,
}: {
  sessionId: string;
  games: Game[];
  teams: Team[];
}) {
  const scorableGames = useMemo(
    () => games.filter((g) => (g.scoring?.weight ?? 0) > 0),
    [games],
  );

  const [gameId, setGameId] = useState(scorableGames[0]?._id ?? "");
  const [placements, setPlacements] = useState<Record<string, number>>({});
  const [manualScores, setManualScores] = useState<Record<string, number>>({});
  const [existing, setExisting] = useState<Record<string, number>>({});
  const [existingManual, setExistingManual] = useState<Record<string, number>>(
    {},
  );
  /** True until this session/game has any saved manual results (enables first save). */
  const [manualHasServerData, setManualHasServerData] = useState(false);
  const [activePlace, setActivePlace] = useState(1);
  const selectRefs = useRef<Record<number, HTMLSelectElement | null>>({});

  useEffect(() => {
    if (
      scorableGames.length &&
      !scorableGames.some((g) => g._id === gameId)
    ) {
      setGameId(scorableGames[0]._id);
    }
  }, [scorableGames, gameId]);

  const game = useMemo(
    () => scorableGames.find((g) => g._id === gameId),
    [scorableGames, gameId],
  );

  const mode = game?.scoring?.scoringMode ?? "placement_points";
  const manualMax = game?.scoring?.manualPointsMax ?? 10;
  const maxPl = game?.scoring?.maxPlacements ?? 6;
  const places = useMemo(
    () => Array.from({ length: maxPl }, (_, i) => i + 1),
    [maxPl],
  );

  useEffect(() => {
    if (!places.includes(activePlace)) {
      setActivePlace(places[0] ?? 1);
    }
  }, [places, activePlace]);

  useEffect(() => {
    if (!sessionId || !gameId) return;
    let cancelled = false;
    (async () => {
      const res = await fetch(
        `/api/game-results?sessionId=${sessionId}&gameId=${gameId}`,
      );
      const rows = await res.json();
      if (cancelled || !Array.isArray(rows)) return;

      if (mode === "manual_points") {
        const nextM: Record<string, number> = {};
        for (const t of teams) {
          nextM[t._id] = 0;
        }
        for (const r of rows) {
          nextM[String(r.teamId)] =
            typeof r.pointsAwarded === "number" ? r.pointsAwarded : 0;
        }
        setManualScores(nextM);
        setExistingManual({ ...nextM });
        setManualHasServerData(rows.length > 0);
        return;
      }

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
  }, [sessionId, gameId, mode, teams]);

  function teamAtPlace(place: number): string {
    for (const t of teams) {
      if ((placements[t._id] ?? 0) === place) return t._id;
    }
    return "";
  }

  function setTeamAtPlace(place: number, teamId: string) {
    setPlacements((prev) => {
      const next: Record<string, number> = { ...prev };
      for (const t of teams) {
        if (next[t._id] === place) next[t._id] = 0;
      }
      if (teamId) next[teamId] = place;
      return next;
    });
  }

  function previewPoints(place: number): string | number {
    if (!game) return "—";
    const tid = teamAtPlace(place);
    if (!tid) return "—";
    try {
      return pointsForPlacement(game.scoring, place);
    } catch {
      return "—";
    }
  }

  async function save() {
    if (!game) return;

    if (mode === "manual_points") {
      const results = teams.map((t) => ({
        teamId: t._id,
        points: clampManualPoints(
          manualScores[t._id] ?? 0,
          manualMax,
        ),
      }));
      const res = await fetch("/api/game-results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, gameId, results }),
      });
      const data = await res.json();
      if (!res.ok) {
        showError(String(data.error ?? "Save failed"));
        return;
      }
      showSuccess("Scores saved");
      setExistingManual({ ...manualScores });
      setManualHasServerData(true);
      return;
    }

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
      showError(String(data.error ?? "Save failed"));
      return;
    }
    showSuccess("Results saved");
    setExisting({ ...placements });
  }

  if (!sessionId) {
    return (
      <p className="text-sm text-amber-700 dark:text-amber-400">
        No session id. Seed or create a session.
      </p>
    );
  }

  if (!scorableGames.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No weighted scoring games. Run seed or set game weights in Games admin.
      </p>
    );
  }

  const placementDirty = teams.some(
    (t) => (placements[t._id] ?? 0) !== (existing[t._id] ?? 0),
  );
  const manualDirty = teams.some((t) => {
    const cur = clampManualPoints(manualScores[t._id] ?? 0, manualMax);
    const prev = existingManual[t._id] ?? 0;
    return Math.abs(cur - prev) > 0.0001;
  });
  const isDirty =
    mode === "manual_points"
      ? manualDirty || !manualHasServerData
      : placementDirty;

  const usePlacementGrid =
    mode === "placement_points" || mode === "amazing_race_finish";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block min-w-0 flex-1 text-sm sm:min-w-[14rem]">
          <span className="text-muted-foreground">Game</span>
          <select
            className="ui-field mt-1 w-full rounded-lg px-2 py-1.5 text-sm"
            value={gameId}
            onChange={(e) => setGameId(e.target.value)}
          >
            {scorableGames.map((g) => (
              <option key={g._id} value={g._id}>
                {g.name} ({g.scoring?.scoringMode})
              </option>
            ))}
          </select>
        </label>
        {game ? (
          <p className="max-w-xl pb-1 text-xs leading-snug text-muted-foreground">
            {mode === "manual_points" ? (
              <>
                Enter a weighted score per team (0–{manualMax}) toward the /100
                camp total — not 1st–6th placement. Saved values rank teams for
                the breakdown only.
              </>
            ) : mode === "amazing_race_first_only" ? (
              <>
                Only <strong>1st place</strong> earns <strong>30</strong> pts
                toward /100; 2nd–6th earn 0 for this leg. Row:{" "}
                {(game.scoring?.placementPoints ?? []).join(" · ")} · ×
                {game.scoring?.weight ?? 1}
              </>
            ) : (
              <>
                Row: {(game.scoring?.placementPoints ?? []).join(" · ")} · ×
                {game.scoring?.weight ?? 1}
                {mode === "amazing_race_finish"
                  ? " · Finish order → points."
                  : ""}
              </>
            )}
          </p>
        ) : null}
      </div>

      {game && mode === "manual_points" ? (
        <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
          <p className="mb-3 text-xs font-medium text-muted-foreground">
            Score per team (0–{manualMax})
          </p>
          <ul className="space-y-2">
            {teams.map((t) => {
              const raw = manualScores[t._id] ?? 0;
              const display = Number.isFinite(raw) ? raw : 0;
              const saved =
                Math.abs(
                  clampManualPoints(display, manualMax) -
                    (existingManual[t._id] ?? 0),
                ) < 0.0001 ? (
                  <span className="text-emerald-600 dark:text-emerald-400">
                    ✓
                  </span>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400">Δ</span>
                );
              return (
                <li
                  key={t._id}
                  className="flex flex-wrap items-center gap-2 sm:gap-3"
                >
                  <span className="min-w-[6rem] text-sm font-medium">
                    {t.name}
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={manualMax}
                    step={0.5}
                    className="ui-field w-24 rounded-md px-2 py-1.5 text-sm"
                    value={display}
                    onChange={(e) => {
                      const v = e.target.value;
                      const n = v === "" ? 0 : Number(v);
                      setManualScores((prev) => ({
                        ...prev,
                        [t._id]: Number.isNaN(n) ? 0 : n,
                      }));
                    }}
                  />
                  <span className="text-xs text-muted-foreground">{saved}</span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {game && mode === "amazing_race_first_only" ? (
        <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
          <p className="mb-2 text-sm font-medium text-foreground">
            Winning team (first to finish)
          </p>
          <p className="mb-3 text-xs text-muted-foreground">
            Pick the team that completed the full Amazing Race first. Other
            places are filled automatically for the record; only 1st place
            receives points.
          </p>
          <select
            className="ui-field w-full max-w-md rounded-lg px-2 py-2 text-sm"
            aria-label="Amazing Race winning team"
            value={teamAtPlace(1)}
            onChange={(e) => {
              const id = e.target.value;
              if (!id) {
                setPlacements({});
                return;
              }
              setPlacements(fillPlacesAfterFirst(id, teams));
            }}
          >
            <option value="">— Select team —</option>
            {teams.map((t) => (
              <option key={t._id} value={t._id}>
                {t.name}
              </option>
            ))}
          </select>
          <ol className="mt-4 space-y-1 text-xs text-muted-foreground">
            {places.map((p) => {
              const tid = teamAtPlace(p);
              const name = tid
                ? teams.find((x) => x._id === tid)?.name ?? "—"
                : "—";
              return (
                <li key={p}>
                  <span className="font-medium text-foreground">
                    {ordinal(p)}
                  </span>
                  : {name}{" "}
                  <span className="font-mono">
                    ({previewPoints(p)} pts)
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}

      {game && usePlacementGrid ? (
        <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Finish order — pick one team per place ({ordinal(1)} …{" "}
            {ordinal(maxPl)})
          </p>

          <div
            className="-mx-1 flex gap-1 overflow-x-auto pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible"
            aria-label="Placement (finish order)"
          >
            {places.map((p) => {
              const isActive = activePlace === p;
              return (
                <button
                  key={p}
                  type="button"
                  id={`place-tab-${p}`}
                  className={
                    "shrink-0 rounded-t-md border px-2.5 py-1.5 text-xs font-semibold transition-colors sm:text-sm " +
                    (isActive
                      ? "border-border border-b-transparent bg-background text-foreground"
                      : "border-transparent bg-muted/60 text-muted-foreground hover:bg-muted")
                  }
                  onClick={() => {
                    setActivePlace(p);
                    selectRefs.current[p]?.focus();
                  }}
                >
                  {ordinal(p)}
                </button>
              );
            })}
          </div>

          <div
            className="grid grid-cols-2 gap-2 border border-t-0 border-border bg-background p-2 sm:grid-cols-3 md:grid-cols-6 md:gap-2 md:p-2"
            role="presentation"
          >
            {places.map((p) => {
              const tid = teamAtPlace(p);
              const savedMatch =
                tid && existing[tid] === p ? (
                  <span className="text-emerald-600 dark:text-emerald-400">
                    ✓
                  </span>
                ) : tid ? (
                  <span className="text-amber-600 dark:text-amber-400">Δ</span>
                ) : null;
              return (
                <div
                  key={p}
                  className={
                    "flex min-w-0 flex-col gap-1 rounded-md md:items-stretch " +
                    (activePlace === p
                      ? "ring-2 ring-primary/40 ring-offset-2 ring-offset-background"
                      : "")
                  }
                >
                  <div className="flex items-center justify-between gap-1 md:hidden">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {ordinal(p)}
                    </span>
                    {savedMatch}
                  </div>
                  <select
                    ref={(el) => {
                      selectRefs.current[p] = el;
                    }}
                    className="ui-field w-full min-w-0 max-w-full rounded-md py-1.5 pl-2 pr-7 text-xs sm:text-sm"
                    aria-label={`Team for ${ordinal(p)} place`}
                    value={tid}
                    onChange={(e) => setTeamAtPlace(p, e.target.value)}
                    onFocus={() => setActivePlace(p)}
                  >
                    <option value="">—</option>
                    {teams.map((t) => (
                      <option key={t._id} value={t._id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <div className="hidden items-center justify-between gap-1 md:flex">
                    <span className="truncate font-mono text-[10px] text-muted-foreground">
                      {previewPoints(p)} pts
                    </span>
                    <span className="shrink-0 text-xs">{savedMatch}</span>
                  </div>
                  <div className="flex items-center justify-between gap-1 md:hidden">
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {previewPoints(p)} pts
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={save}
        disabled={!isDirty}
        className="ui-button rounded-xl px-4 py-2 text-sm disabled:pointer-events-none disabled:opacity-50"
      >
        {mode === "manual_points"
          ? "Save scores"
          : "Save results (1–" + maxPl + " each team once)"}
      </button>
    </div>
  );
}
