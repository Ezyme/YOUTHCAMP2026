"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw, Undo2 } from "lucide-react";
import {
  boardsMatchPersisted,
  cloneMindgameState,
  createInitialState,
  deserializePositions,
  getDiagonalEdges,
  getFixedBoardPersistSnapshot,
  isWinning,
  serializePositions,
  stepPin,
  type BoardVariant,
  type MindgameGoal,
  type MindgameState,
} from "@/lib/games/mindgame/engine";
import { showError, showInfo, showSuccess } from "@/lib/ui/toast";

const MAX_UNDO = 400;
const UNIT = 18;
const PAD = 12;

/** Shared state for a camp group; otherwise one key per browser. Variant suffix keeps saves separate. */
function makeClientKey(sessionId?: string, teamId?: string, variant: BoardVariant = "standard"): string {
  let base: string;
  if (sessionId && teamId) {
    base = `group:${sessionId}:${teamId}`;
  } else if (typeof window === "undefined") {
    base = "ssr";
  } else {
    let k = window.localStorage.getItem("youthcamp_client_key");
    if (!k) {
      k = `mg-${Math.random().toString(36).slice(2)}`;
      window.localStorage.setItem("youthcamp_client_key", k);
    }
    base = k;
  }
  return variant === "quick" ? `${base}:8` : `${base}:10`;
}

function MindgameBoardInner({
  sessionId,
  teamId,
  goal,
  variant,
}: {
  sessionId?: string;
  teamId?: string;
  goal: MindgameGoal;
  variant: BoardVariant;
}) {
  const [state, setState] = useState<MindgameState>(() => createInitialState(goal, variant));
  const [selected, setSelected] = useState<number | null>(null);
  const [moves, setMoves] = useState(0);
  const undoStackRef = useRef<{ state: MindgameState; moves: number }[]>([]);
  const [undoLen, setUndoLen] = useState(0);
  const selectedRef = useRef<number | null>(null);
  selectedRef.current = selected;

  const clearUndoHistory = useCallback(() => {
    undoStackRef.current = [];
    setUndoLen(0);
  }, []);

  const pushUndoSnapshot = useCallback(
    (snapshot: MindgameState, moveCount: number) => {
      const stack = undoStackRef.current;
      stack.push({ state: cloneMindgameState(snapshot), moves: moveCount });
      while (stack.length > MAX_UNDO) stack.shift();
      setUndoLen(stack.length);
    },
    [],
  );

  const boardSnapshot = useMemo(() => getFixedBoardPersistSnapshot(variant), [variant]);
  const diagonalEdgePairs = useMemo(() => getDiagonalEdges(variant), [variant]);

  const persist = useCallback(
    async (next: MindgameState, moveCount: number) => {
      const body = {
        clientKey: makeClientKey(sessionId, teamId, variant),
        sessionId: sessionId ?? undefined,
        teamId: teamId ?? undefined,
        gridRows: next.rows,
        gridCols: next.cols,
        playerCount: next.playerCount,
        positions: serializePositions(next.positions),
        blocked: boardSnapshot.blocked,
        diagonalNodes: boardSnapshot.diagonalNodes,
        goal: next.goal,
        moves: moveCount,
      };
      const res = await fetch("/api/mindgame/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showError(String(data.error ?? `Save failed (${res.status})`));
      }
    },
    [sessionId, teamId, boardSnapshot, variant],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const fresh = createInitialState(goal, variant);

      const ck = makeClientKey(sessionId, teamId, variant);
      const params = new URLSearchParams({ clientKey: ck });
      if (sessionId) params.set("sessionId", sessionId);
      if (teamId) params.set("teamId", teamId);

      const res = await fetch(`/api/mindgame/state?${params}`).catch(() => null);
      if (!res) {
        if (!cancelled) showError("Could not load saved board (network).");
        return;
      }
      if (!res.ok) {
        if (!cancelled) {
          const data = await res.json().catch(() => ({}));
          showError(String(data.error ?? `Load failed (${res.status})`));
        }
        return;
      }

      const doc = await res.json();
      if (cancelled) return;

      const match =
        doc?.positions?.length &&
        Number(doc.gridRows) === fresh.rows &&
        Number(doc.gridCols) === fresh.cols &&
        Number(doc.playerCount) === fresh.playerCount &&
        String(doc.goal) === goal &&
        boardsMatchPersisted(doc.blocked, doc.diagonalNodes, variant);

      if (match) {
        try {
          const s: MindgameState = {
            rows: doc.gridRows,
            cols: doc.gridCols,
            playerCount: doc.playerCount,
            positions: deserializePositions(doc.positions),
            goal: doc.goal as MindgameGoal,
            blocked: fresh.blocked,
            diagonalNodes: fresh.diagonalNodes,
          };
          clearUndoHistory();
          setState(s);
          setMoves(doc.moves ?? 0);
        } catch {
          if (!cancelled) showError("Saved board data was invalid — using a fresh layout.");
        }
        return;
      }

      clearUndoHistory();
      setState(fresh);
      setMoves(0);
      if (doc?.positions?.length && !match) {
        showInfo("Saved layout didn't match — starting a fresh board.");
      }
      if (sessionId && teamId) {
        await persist(fresh, 0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, teamId, goal, variant, persist, clearUndoHistory]);

  const won = isWinning(state);

  useEffect(() => {
    if (won) setSelected(null);
  }, [won]);

  const pinAt = useMemo(() => {
    const m = new Map<string, number>();
    for (const [p, cell] of state.positions) {
      m.set(`${cell.r},${cell.c}`, p);
    }
    return m;
  }, [state.positions]);

  const { rows, cols } = state;
  const vbW = PAD * 2 + Math.max(1, cols - 1) * UNIT;
  const vbH = PAD * 2 + Math.max(1, rows - 1) * UNIT;

  const handleUndo = useCallback(async () => {
    const stack = undoStackRef.current;
    if (stack.length === 0) return;
    const entry = stack.pop()!;
    setUndoLen(stack.length);
    setState(entry.state);
    setMoves(entry.moves);
    showInfo("Move undone.");
    setSelected(null);
    await persist(entry.state, entry.moves);
  }, [persist]);

  const handleResetLayout = useCallback(async () => {
    const fresh = createInitialState(goal, variant);
    clearUndoHistory();
    setState(fresh);
    setMoves(0);
    setSelected(null);
    showSuccess("Layout reset.");
    await persist(fresh, 0);
  }, [goal, variant, persist, clearUndoHistory]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        const t = e.target as HTMLElement | null;
        if (t?.closest?.("textarea, input, select, [contenteditable=true]")) return;
        if (selectedRef.current !== null) {
          setSelected(null);
          showInfo("Selection cleared.");
        }
        return;
      }
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "z") return;
      if (e.shiftKey) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest?.("textarea, input, select, [contenteditable=true]")) return;
      e.preventDefault();
      void handleUndo();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleUndo]);

  const canUndo = undoLen > 0;

  async function onVertexClick(r: number, c: number) {
    if (won) return;
    if (state.blocked.has(`${r},${c}`)) return;
    const pin = pinAt.get(`${r},${c}`) ?? null;
    if (pin !== null) {
      if (selected === pin) {
        setSelected(null);
        showInfo("Pin deselected.");
        return;
      }
      setSelected(pin);
      showInfo(`Pin ${pin + 1} selected — tap an adjacent crossing.`);
      return;
    }
    if (selected === null) {
      showInfo("Tap a pin first.");
      return;
    }

    const next = stepPin(state, selected, { r, c });
    if (!next) {
      showError("Invalid move — only 1 step to an empty crossing.");
      return;
    }
    const nextMoves = moves + 1;
    pushUndoSnapshot(state, moves);
    setState(next);
    setMoves(nextMoves);
    await persist(next, nextMoves);
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <span>
          Moves: <span className="font-mono">{moves}</span>
        </span>
        <button
          type="button"
          disabled={!canUndo}
          onClick={() => void handleUndo()}
          className="ui-button-secondary inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Undo2 className="size-3.5" aria-hidden />
          Undo
        </button>
        <button
          type="button"
          onClick={() => void handleResetLayout()}
          className="ui-button-secondary inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-foreground"
        >
          <RotateCcw className="size-3.5" aria-hidden />
          Reset layout
        </button>
        {won ? (
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
            Goal met
          </span>
        ) : null}
      </div>
      <div
        className="mx-auto w-full max-w-[min(100%,96vw,24rem)] shrink-0 max-h-[min(78svh,72dvh,48rem)]"
        style={{ aspectRatio: `${vbW} / ${vbH}`, touchAction: "manipulation" }}
      >
        <svg
          className="size-full text-muted-foreground"
          viewBox={`0 0 ${vbW} ${vbH}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Mindgame lattice: fixed puzzle map"
        >
          <title>Pins on grid intersections</title>

          {Array.from({ length: rows }, (_, r) => (
            <line
              key={`h-${r}`}
              x1={PAD}
              y1={PAD + r * UNIT}
              x2={PAD + (cols - 1) * UNIT}
              y2={PAD + r * UNIT}
              stroke="currentColor"
              strokeWidth={0.6}
            />
          ))}
          {Array.from({ length: cols }, (_, c) => (
            <line
              key={`v-${c}`}
              x1={PAD + c * UNIT}
              y1={PAD}
              x2={PAD + c * UNIT}
              y2={PAD + (rows - 1) * UNIT}
              stroke="currentColor"
              strokeWidth={0.6}
            />
          ))}

          {diagonalEdgePairs.map(([from, to], i) => (
            <line
              key={`diag-edge-${i}`}
              x1={PAD + from.c * UNIT}
              y1={PAD + from.r * UNIT}
              x2={PAD + to.c * UNIT}
              y2={PAD + to.r * UNIT}
              className="stroke-violet-400/85 dark:stroke-violet-500/85"
              strokeWidth={1.2}
              strokeDasharray="3 2.5"
              pointerEvents="none"
            />
          ))}

          {Array.from({ length: rows }, (_, r) =>
            Array.from({ length: cols }, (_, c) => {
              const x = PAD + c * UNIT;
              const y = PAD + r * UNIT;
              const cellKey = `${r},${c}`;
              const pin = pinAt.get(cellKey);
              const isSel = pin !== undefined && selected === pin;
              const isBlocked = state.blocked.has(cellKey);
              const isDiag = state.diagonalNodes.has(cellKey);

              if (isBlocked) {
                return (
                  <g key={`n-${r}-${c}`} className="pointer-events-none">
                    <rect
                      x={x - 4.8}
                      y={y - 4.8}
                      width={9.6}
                      height={9.6}
                      rx={1}
                      className="fill-muted-foreground"
                    />
                    <line
                      x1={x - 3.2}
                      y1={y - 3.2}
                      x2={x + 3.2}
                      y2={y + 3.2}
                      className="stroke-background"
                      strokeWidth={0.85}
                    />
                    <line
                      x1={x + 3.2}
                      y1={y - 3.2}
                      x2={x - 3.2}
                      y2={y + 3.2}
                      className="stroke-background"
                      strokeWidth={0.85}
                    />
                  </g>
                );
              }

              return (
                <g key={`n-${r}-${c}`}>
                  {isDiag ? (
                    <polygon
                      points={`${x},${y - 5.5} ${x + 5.5},${y} ${x},${y + 5.5} ${x - 5.5},${y}`}
                      className={
                        pin !== undefined
                          ? "fill-violet-500/35 dark:fill-violet-400/30"
                          : "fill-violet-400/90 dark:fill-violet-500/80"
                      }
                      style={{ pointerEvents: "none" }}
                    />
                  ) : null}
                  {pin !== undefined && isSel ? (
                    <circle
                      cx={x}
                      cy={y}
                      r={8.6}
                      fill="none"
                      className="stroke-amber-500 dark:stroke-amber-300"
                      strokeWidth={2}
                      strokeOpacity={0.95}
                      style={{ pointerEvents: "none" }}
                    />
                  ) : null}
                  {pin !== undefined && isSel ? (
                    <circle
                      cx={x}
                      cy={y}
                      r={7.15}
                      fill="none"
                      className="stroke-amber-400/55 dark:stroke-amber-200/45"
                      strokeWidth={1.1}
                      style={{ pointerEvents: "none" }}
                    />
                  ) : null}
                  <circle
                    cx={x}
                    cy={y}
                    r={pin !== undefined ? 5.6 : isDiag ? 3.6 : 2.4}
                    className={
                      pin !== undefined
                        ? isSel
                          ? "fill-primary outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-amber-400"
                          : "fill-primary/90 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-primary"
                        : isDiag
                          ? "fill-transparent outline-none"
                          : "fill-muted outline-none"
                    }
                    style={{ cursor: "pointer" }}
                    onClick={() => void onVertexClick(r, c)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        void onVertexClick(r, c);
                      }
                    }}
                    tabIndex={pin !== undefined ? 0 : -1}
                    aria-label={
                      pin !== undefined
                        ? isSel
                          ? `Pin ${pin + 1}, selected. Press Enter to deselect, or choose an adjacent empty crossing to move.`
                          : `Pin ${pin + 1}. Press Enter or Space to select.`
                        : undefined
                    }
                    aria-pressed={pin !== undefined ? isSel : undefined}
                  />
                  {pin !== undefined ? (
                    <text
                      x={x}
                      y={y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={7.5}
                      fontWeight={600}
                      className="fill-white dark:fill-zinc-950"
                      style={{ pointerEvents: "none", userSelect: "none" }}
                    >
                      {pin + 1}
                    </text>
                  ) : null}
                </g>
              );
            }),
          )}
        </svg>
      </div>
    </>
  );
}

export function MindgameBoard({
  sessionId,
  teamId,
  groupLabel,
}: {
  sessionId?: string;
  teamId?: string;
  groupLabel?: string;
}) {
  const [goal, setGoal] = useState<MindgameGoal>("sort_desc");
  const [boardVariant, setBoardVariant] = useState<BoardVariant>("standard");

  const boardLabel =
    boardVariant === "quick" ? "8 × 3 (8 pins)" : "10 × 3 (10 pins)";

  return (
    <div className="space-y-6">
      {teamId && sessionId ? (
        <p className="rounded-lg bg-primary/10 px-3 py-2 text-xs text-primary">
          Group board{groupLabel ? `: ${groupLabel}` : ""} — progress syncs for
          everyone using this team link.
        </p>
      ) : null}

      <div className="ui-card-muted rounded-xl p-4 text-xs leading-relaxed text-foreground">
        <p className="font-semibold text-foreground">How to play ({boardLabel})</p>
        <ul className="mt-2 list-inside list-disc space-y-1.5">
          <li>
            Tap a pin, then tap a <strong>neighboring empty crossing</strong> (1 step).
          </li>
          <li>
            <strong>Walls (X)</strong> block moves. <strong>Violet diamonds</strong> enable diagonals
            (both ends must be diamonds).
          </li>
          <li>
            Goal: line up every pin on the <strong>center column</strong>, sorted top-to-bottom.
          </li>
          <li>Use Undo / Reset anytime.</li>
        </ul>
        <p className="mt-3 rounded-md bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900 dark:bg-amber-950/60 dark:text-amber-100">
          <strong>Tip:</strong> park outer pins first, finish the middle column last.
        </p>
      </div>

      <div className="ui-card flex flex-col gap-4 rounded-xl p-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="text-xs">
          <span className="block font-medium text-foreground">Board</span>
          <div
            className="mt-1 inline-flex rounded-lg border border-border p-0.5"
            role="group"
            aria-label="Board size"
          >
            <button
              type="button"
              onClick={() => setBoardVariant("standard")}
              className={
                boardVariant === "standard"
                  ? "rounded-md bg-primary px-3 py-1.5 text-primary-foreground"
                  : "rounded-md px-3 py-1.5 text-muted-foreground hover:bg-muted"
              }
            >
              Standard (10 pins)
            </button>
            <button
              type="button"
              onClick={() => setBoardVariant("quick")}
              className={
                boardVariant === "quick"
                  ? "rounded-md bg-primary px-3 py-1.5 text-primary-foreground"
                  : "rounded-md px-3 py-1.5 text-muted-foreground hover:bg-muted"
              }
            >
              Quick (8 pins)
            </button>
          </div>
        </div>
        <label className="text-xs">
          Goal
          <select
            className="ui-field mt-1 block rounded px-2 py-1 text-xs"
            value={goal}
            onChange={(e) => setGoal(e.target.value as MindgameGoal)}
          >
            <option value="sort_desc">Highest → lowest (top to bottom on center column)</option>
            <option value="sort_asc">Lowest → highest (top to bottom on center column)</option>
            <option value="odd_even">Odds then evens (top to bottom on center column)</option>
          </select>
        </label>
      </div>

      <MindgameBoardInner
        key={`${goal}-${boardVariant}`}
        sessionId={sessionId}
        teamId={teamId}
        goal={goal}
        variant={boardVariant}
      />

      <p className="text-xs text-muted-foreground">
        Goal: one vertical line on the <strong>center column</strong>, correct order top to bottom.
        Tap a pin to activate it — it <strong>stays selected</strong> after each step until you tap it
        again, pick another pin, or press <kbd className="rounded border border-border px-1">Esc</kbd>.
        Then tap a <strong>next-door</strong> empty crossing (one step). Use{" "}
        <strong className="font-medium text-foreground">Undo</strong> /{" "}
        <kbd className="rounded border border-border px-1">Ctrl+Z</kbd> or{" "}
        <strong className="font-medium text-foreground">Reset layout</strong>.
      </p>
    </div>
  );
}
