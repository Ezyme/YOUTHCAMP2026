"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Heart,
  Flag,
  Shield,
  Eye,
  Sparkles,
  Search,
  RotateCcw,
  Expand,
  Crosshair,
  Compass,
  Footprints,
  Trophy,
  Bomb,
  ChevronDown,
  ChevronRight,
  ChevronUp,
} from "lucide-react";
import {
  generateBoard,
  seededShuffle,
  sortPersistedFragmentsForBoard,
  CHECK_PASSAGE_WRONG_PENALTY_SECONDS,
  REMAINING_HEART_CLOCK_REDUCTION_SECONDS,
  type Board,
} from "@/lib/games/unmasked/engine";
import {
  applyFlagLocal,
  applyRevealLocal,
  type OptimisticStateSlice,
} from "@/lib/games/unmasked/local-apply";
import {
  clearLocalMirror,
  readLocalMirror,
  writeLocalMirror,
} from "@/lib/games/unmasked/mirror";
import { getVerseByKey } from "@/lib/games/unmasked/verses";
import type { PowerUpType } from "@/lib/db/models";
import { showError, showInfo, showSuccess, showWarning } from "@/lib/ui/toast";
import {
  POWER_UP_ARMED_BANNER,
  POWER_UP_HINT,
  POWER_UP_NAME,
  POWER_UP_SHORT,
} from "@/lib/ui/powerup-copy";

type VerseFragRow = { index: number; text: string; order: number; verseKey: string };

type PersistedState = {
  seed: number;
  gridSize: number;
  totalLies: number;
  verseKey?: string;
  verseKeys?: string[];
  revealed: number[];
  flagged: number[];
  hearts: number;
  maxHearts: number;
  verseFragments: VerseFragRow[];
  verseAssemblyIndices?: number[];
  verseAssembly?: number[];
  versesRestored?: string[];
  passagesComplete?: boolean;
  verseCompleted?: boolean;
  redeemedCodes: string[];
  powerUps: { type: PowerUpType; used: boolean }[];
  shielded: boolean;
  status: "playing" | "won" | "lost";
  liesHit: number;
  startedAt: string;
  finishedAt?: string;
  checkPassagePenaltySeconds?: number;
  /** ISO time of last play-client activity (GET state / actions). Omitted on legacy docs. */
  lastPlayActivityAt?: string | null;
};

/** Admin spectator: timer runs only while the team is actively playing (recent API activity). */
const LIVE_PLAY_MS = 12_000;

const POWER_UP_LABELS: Record<PowerUpType, { label: string; icon: typeof Shield }> = {
  extra_heart: { label: "Extra Heart", icon: Heart },
  reveal: { label: "Reveal", icon: Sparkles },
  scout: { label: "Scout", icon: Search },
  shield: { label: "Shield", icon: Shield },
  safe_opening: { label: "Safe opening", icon: Expand },
  truth_radar: { label: "Truth Radar", icon: Crosshair },
  lie_pin: { label: "Lie Pin", icon: Flag },
  verse_compass: { label: "Verse Compass", icon: Compass },
  gentle_step: { label: "Gentle Step", icon: Footprints },
};

/** Scout peek kind as shown in UI / toasts (tile is still hidden). */
function formatScoutPeekKind(kind: string): string {
  switch (kind) {
    case "lie":
      return "Danger (Lie)";
    case "verse":
      return "Passage tile (Verse)";
    default:
      return "Safe (Truth)";
  }
}

const ALL_POWER_UP_TYPES: PowerUpType[] = [
  "extra_heart",
  "reveal",
  "scout",
  "shield",
  "safe_opening",
  "truth_radar",
  "lie_pin",
  "verse_compass",
  "gentle_step",
];

const ARMABLE_POWER_UPS = new Set<PowerUpType>([
  "scout",
  "truth_radar",
  "verse_compass",
  "lie_pin",
  "gentle_step",
]);

/**
 * Verse fragment palette. Picked deterministically from the verseKey so the same passage
 * always uses the same colour pair across the bank, builder row, and legend.
 */
const VERSE_PALETTE: { bg: string; text: string; ring: string; chip: string }[] = [
  {
    bg: "bg-amber-100 dark:bg-amber-900/60",
    text: "text-amber-950 dark:text-amber-50",
    ring: "border-amber-400 dark:border-amber-700",
    chip: "bg-amber-500",
  },
  {
    bg: "bg-sky-100 dark:bg-sky-900/60",
    text: "text-sky-950 dark:text-sky-50",
    ring: "border-sky-400 dark:border-sky-700",
    chip: "bg-sky-500",
  },
  {
    bg: "bg-emerald-100 dark:bg-emerald-900/60",
    text: "text-emerald-950 dark:text-emerald-50",
    ring: "border-emerald-400 dark:border-emerald-700",
    chip: "bg-emerald-500",
  },
  {
    bg: "bg-violet-100 dark:bg-violet-900/60",
    text: "text-violet-950 dark:text-violet-50",
    ring: "border-violet-400 dark:border-violet-700",
    chip: "bg-violet-500",
  },
  {
    bg: "bg-rose-100 dark:bg-rose-900/60",
    text: "text-rose-950 dark:text-rose-50",
    ring: "border-rose-400 dark:border-rose-700",
    chip: "bg-rose-500",
  },
  {
    bg: "bg-cyan-100 dark:bg-cyan-900/60",
    text: "text-cyan-950 dark:text-cyan-50",
    ring: "border-cyan-400 dark:border-cyan-700",
    chip: "bg-cyan-500",
  },
];

function verseColorIndex(verseKey: string, ordered: string[]): number {
  const idx = ordered.indexOf(verseKey);
  if (idx >= 0) return idx % VERSE_PALETTE.length;
  // Fallback hash
  let h = 0;
  for (let i = 0; i < verseKey.length; i++) h = (h * 31 + verseKey.charCodeAt(i)) | 0;
  return Math.abs(h) % VERSE_PALETTE.length;
}

/** Mine counts: tuned for light tile surfaces (same in light and dark site theme). */
function numberColor(n: number): string {
  const colors = [
    "",
    "text-blue-600",
    "text-green-600",
    "text-red-600",
    "text-purple-700",
    "text-orange-700",
    "text-teal-600",
    "text-zinc-700",
    "text-zinc-500",
  ];
  return colors[n] ?? "text-zinc-600";
}

function normalizeLoadedState(data: PersistedState): {
  verseKeys: string[];
  verseFragments: VerseFragRow[];
  assembly: number[];
  restored: string[];
} {
  const legacyKey = data.verseKey ?? "";
  let keys =
    data.verseKeys?.length ? data.verseKeys
    : legacyKey ? [legacyKey]
    : [];
  const frags = (data.verseFragments ?? []).map((f) => ({
    ...f,
    verseKey: f.verseKey ?? legacyKey,
  }));
  if (keys.length === 0 && frags.length > 0) {
    keys = [...new Set(frags.map((f) => f.verseKey))];
  }
  const assembly =
    data.verseAssemblyIndices?.length ? data.verseAssemblyIndices
    : data.verseAssembly ?? [];
  let restored = data.versesRestored ?? [];
  if (!restored.length && data.verseCompleted && legacyKey) {
    restored = [legacyKey];
  }
  return { verseKeys: keys, verseFragments: frags, assembly, restored };
}

function TruthRadarChooser({
  anchor,
  gridContainer,
  row,
  col,
  gridSize,
  onChoose,
  onCancel,
}: {
  anchor: HTMLElement | null;
  gridContainer: HTMLElement | null;
  row: number;
  col: number;
  gridSize: number;
  onChoose: (axis: "row" | "col") => void;
  onCancel: () => void;
}) {
  const [pos, setPos] = useState<{ top: number; left: number; placement: "above" | "below" } | null>(
    null,
  );
  const cardRef = useRef<HTMLDivElement | null>(null);

  const recompute = useCallback(() => {
    if (!anchor || !gridContainer) {
      setPos(null);
      return;
    }
    const a = anchor.getBoundingClientRect();
    const g = gridContainer.getBoundingClientRect();
    const placement: "above" | "below" = row === 0 ? "below" : "above";
    const cardWidth = cardRef.current?.offsetWidth ?? 140;
    const cardHeight = cardRef.current?.offsetHeight ?? 36;
    const gap = 8;

    const tileLeft = a.left - g.left;
    const tileTop = a.top - g.top;
    const tileWidth = a.width;
    const tileHeight = a.height;

    let left: number;
    if (col === 0) left = tileLeft + tileWidth + gap;
    else if (col === gridSize - 1) left = tileLeft - cardWidth - gap;
    else left = tileLeft + tileWidth / 2 - cardWidth / 2;

    const top =
      placement === "above" ? tileTop - cardHeight - gap : tileTop + tileHeight + gap;

    setPos({ top, left, placement });
  }, [anchor, gridContainer, row, col, gridSize]);

  useLayoutEffect(() => {
    // Measure-then-position pattern: setState here is intentional and synchronous
    // before paint to avoid a flash of an unpositioned popover.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    recompute();
    // First pass uses the 140/36 fallback because cardRef has not mounted yet.
    // Re-measure on the next frame so the popover centers on the true card width.
    const raf = requestAnimationFrame(() => recompute());
    return () => cancelAnimationFrame(raf);
  }, [recompute]);

  useEffect(() => {
    if (!anchor || !gridContainer) return;
    const onResize = () => recompute();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    const ro = new ResizeObserver(onResize);
    ro.observe(gridContainer);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
      ro.disconnect();
    };
  }, [anchor, gridContainer, recompute]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node | null;
      if (cardRef.current && target && cardRef.current.contains(target)) return;
      if (gridContainer && target && gridContainer.contains(target)) return;
      onCancel();
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [gridContainer, onCancel]);

  if (!pos) return null;

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-label="Truth Radar axis"
      className="absolute z-30 flex items-center gap-1 rounded-md border border-primary/40 bg-background/95 px-1.5 py-1 shadow-md backdrop-blur"
      style={{ top: pos.top, left: pos.left }}
    >
      <button
        type="button"
        autoFocus
        onClick={() => onChoose("row")}
        className="rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/15 focus:outline-none focus:ring-2 focus:ring-primary/40"
      >
        Row
      </button>
      <button
        type="button"
        onClick={() => onChoose("col")}
        className="rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/15 focus:outline-none focus:ring-2 focus:ring-primary/40"
      >
        Column
      </button>
    </div>
  );
}

export function UnmaskedBoard({
  sessionId,
  teamId,
  groupLabel,
  gameSlug = "unmasked",
  readOnly = false,
}: {
  sessionId: string;
  teamId: string;
  groupLabel?: string;
  /** Game definition slug (for Unmasked settings like safe-opening minimum). */
  gameSlug?: string;
  settings?: Record<string, unknown>;
  /** Admin spectator: load via `/api/admin/unmasked/state`, no play actions. */
  readOnly?: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [retrying, setRetrying] = useState(false);

  const [board, setBoard] = useState<Board | null>(null);
  /** Board seed — used to shuffle passage stack order (stable per run, not verse order). */
  const [layoutSeed, setLayoutSeed] = useState(0);
  const [verseKeys, setVerseKeys] = useState<string[]>([]);
  const [verseFragments, setVerseFragments] = useState<VerseFragRow[]>([]);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [flagged, setFlagged] = useState<Set<number>>(new Set());
  const [hearts, setHearts] = useState(3);
  const [maxHearts, setMaxHearts] = useState(3);
  const [liesHit, setLiesHit] = useState(0);
  const [shielded, setShielded] = useState(false);
  const [status, setStatus] = useState<"playing" | "won" | "lost">("playing");
  const [powerUps, setPowerUps] = useState<{ type: PowerUpType; used: boolean }[]>([]);
  const [verseAssemblyIndices, setVerseAssemblyIndices] = useState<number[]>([]);
  const [versesRestored, setVersesRestored] = useState<string[]>([]);
  const [passagesComplete, setPassagesComplete] = useState(false);
  const [redeemedCodes, setRedeemedCodes] = useState<string[]>([]);
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [checkPassagePenaltySeconds, setCheckPassagePenaltySeconds] = useState(0);
  const [lastPlayActivityAt, setLastPlayActivityAt] = useState<Date | null>(null);
  /** Forces re-render in admin view so “Paused” appears when idle threshold passes. */
  const [readOnlyTick, setReadOnlyTick] = useState(0);

  const [codeInput, setCodeInput] = useState("");
  const [lastSolvedVerse, setLastSolvedVerse] = useState<{
    reference: string;
    full: string;
  } | null>(null);
  const [activePowerUp, setActivePowerUp] = useState<PowerUpType | null>(null);
  const [scoutPeek, setScoutPeek] = useState<{ index: number; kind: string } | null>(null);
  const [flagMode, setFlagMode] = useState(false);
  const [pendingAxisTile, setPendingAxisTile] = useState<number | null>(null);
  const [highlightedTiles, setHighlightedTiles] = useState<Set<number>>(new Set());
  const [highlightMode, setHighlightMode] = useState<
    "reveal" | "safe_opening" | "truth_radar" | "lie_pin" | "verse_compass" | "gentle_step" | null
  >(null);
  const [shimmerTile, setShimmerTile] = useState<number | null>(null);
  const [tipPowerUp, setTipPowerUp] = useState<PowerUpType | null>(null);

  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tileRefs = useRef<Map<number, HTMLElement | null>>(new Map());
  const tileRefSetters = useMemo(() => {
    const count = board?.tiles.length ?? 0;
    const setters: Array<(el: HTMLElement | null) => void> = [];
    for (let i = 0; i < count; i++) {
      setters.push((el) => {
        if (el) tileRefs.current.set(i, el);
        else tileRefs.current.delete(i);
      });
    }
    return setters;
  }, [board?.tiles.length]);
  const gridContainerRef = useRef<HTMLDivElement | null>(null);

  /**
   * Serialize background action POSTs so the server always sees clicks in the
   * same order the user made them — even if five reveals fire inside 100ms.
   * `pendingCountRef` lets reconcile skip work while more updates are in flight.
   */
  const actionQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const pendingCountRef = useRef(0);

  /**
   * Live mirror of mutable state so background POST resolvers can read the
   * latest values even though they were scheduled from a stale closure.
   */
  const latestStateRef = useRef({
    revealed,
    flagged,
    hearts,
    maxHearts,
    liesHit,
    shielded,
    status,
    powerUps,
    versesRestored,
    verseAssemblyIndices,
  });
  latestStateRef.current = {
    revealed,
    flagged,
    hearts,
    maxHearts,
    liesHit,
    shielded,
    status,
    powerUps,
    versesRestored,
    verseAssemblyIndices,
  };

  const cancelPowerUpTip = useCallback(() => {
    if (tipTimer.current) {
      clearTimeout(tipTimer.current);
      tipTimer.current = null;
    }
    setTipPowerUp(null);
  }, []);

  const startPowerUpTip = useCallback((type: PowerUpType) => {
    if (tipTimer.current) clearTimeout(tipTimer.current);
    tipTimer.current = setTimeout(() => {
      setTipPowerUp(type);
      // Auto-dismiss the tooltip after a moment so it never sticks around.
      tipTimer.current = setTimeout(() => setTipPowerUp(null), 3000);
    }, 450);
  }, []);

  const flashTiles = useCallback(
    (
      indices: number[],
      mode: "reveal" | "safe_opening" | "truth_radar" | "lie_pin" | "verse_compass" | "gentle_step",
      duration = 1800,
    ) => {
      setHighlightedTiles(new Set(indices));
      setHighlightMode(mode);
      setTimeout(() => {
        setHighlightedTiles(new Set());
        setHighlightMode(null);
      }, duration);
    },
    [],
  );

  useEffect(() => {
    if (status === "lost" || passagesComplete || !startedAt) return;

    const now = () => Date.now();
    const teamLive =
      !readOnly ||
      (lastPlayActivityAt != null && now() - lastPlayActivityAt.getTime() < LIVE_PLAY_MS);

    if (readOnly && !teamLive) {
      if (lastPlayActivityAt) {
        setElapsed(
          Math.floor((lastPlayActivityAt.getTime() - startedAt.getTime()) / 1000),
        );
      } else {
        setElapsed(Math.floor((now() - startedAt.getTime()) / 1000));
      }
      return;
    }

    const tick = () => {
      setElapsed(Math.floor((Date.now() - startedAt.getTime()) / 1000));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [status, passagesComplete, startedAt, readOnly, lastPlayActivityAt]);

  /** Poll admin view so facilitator sees when a team goes live / idle. */
  useEffect(() => {
    if (!readOnly || !sessionId || !teamId) return;
    const slugQ = encodeURIComponent(gameSlug);
    const url = `/api/admin/unmasked/state?sessionId=${sessionId}&teamId=${teamId}&slug=${slugQ}`;
    const poll = async () => {
      const res = await fetch(url);
      if (!res.ok) return;
      const data: PersistedState = await res.json();
      setLastPlayActivityAt(
        data.lastPlayActivityAt ? new Date(data.lastPlayActivityAt) : null,
      );
      setCheckPassagePenaltySeconds(Math.max(0, Number(data.checkPassagePenaltySeconds ?? 0)));
    };
    void poll();
    const id = window.setInterval(() => void poll(), 5000);
    return () => window.clearInterval(id);
  }, [readOnly, sessionId, teamId, gameSlug]);

  useEffect(() => {
    if (!readOnly || passagesComplete || status === "lost") return;
    const id = window.setInterval(() => setReadOnlyTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [readOnly, passagesComplete, status]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);

      /**
       * Paint last-known mutable state from localStorage synchronously so the
       * board appears in the first frame on reload. Server fetch still runs
       * next and overwrites with authoritative state (mirror only carries
       * slices the server will also return).
       */
      const mirror = readOnly ? null : readLocalMirror(sessionId, teamId);
      if (mirror) {
        setRevealed(new Set(mirror.revealed));
        setFlagged(new Set(mirror.flagged));
        setHearts(mirror.hearts);
        setMaxHearts(mirror.maxHearts);
        setLiesHit(mirror.liesHit);
        setShielded(mirror.shielded);
        setStatus(mirror.status);
        setPowerUps(mirror.powerUps);
        if (Array.isArray(mirror.versesRestored)) setVersesRestored(mirror.versesRestored);
        if (Array.isArray(mirror.verseAssemblyIndices))
          setVerseAssemblyIndices(mirror.verseAssemblyIndices);
      }

      try {
        const slugQ = encodeURIComponent(gameSlug);
        const res = await fetch(
          readOnly
            ? `/api/admin/unmasked/state?sessionId=${sessionId}&teamId=${teamId}&slug=${slugQ}`
            : `/api/unmasked/state?sessionId=${sessionId}&teamId=${teamId}&slug=${slugQ}`,
        );
        if (cancelled) return;
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          const msg =
            readOnly && res.status === 404 ?
              "This team has not opened Unmasked yet — there is no saved board to show."
            : String(d.error ?? "Failed to load");
          setError(msg);
          setLoading(false);
          return;
        }
        const data: PersistedState = await res.json();
        if (cancelled) return;
        const norm = normalizeLoadedState(data);
        const sorted = sortPersistedFragmentsForBoard(
          data.seed,
          data.gridSize,
          data.totalLies,
          norm.verseFragments,
        );
        const b = generateBoard(data.seed, data.gridSize, data.totalLies, sorted);

        setBoard(b);
        setLayoutSeed(data.seed);
        setVerseKeys(norm.verseKeys);
        setVerseFragments(norm.verseFragments);
        setRevealed(new Set(data.revealed));
        setFlagged(new Set(data.flagged));
        setHearts(data.hearts);
        setMaxHearts(data.maxHearts);
        setLiesHit(data.liesHit);
        setShielded(data.shielded);
        setStatus(data.status);
        setPowerUps(data.powerUps);
        setVerseAssemblyIndices(norm.assembly);
        setVersesRestored(norm.restored);
        const derivedPassagesComplete =
          Boolean(data.passagesComplete) ||
          (data.status === "won" &&
            norm.verseKeys.length > 0 &&
            norm.verseKeys.every((k) => norm.restored.includes(k)));
        setPassagesComplete(derivedPassagesComplete);
        setCheckPassagePenaltySeconds(Math.max(0, Number(data.checkPassagePenaltySeconds ?? 0)));
        setRedeemedCodes(data.redeemedCodes);
        setStartedAt(new Date(data.startedAt));
        setLastPlayActivityAt(
          data.lastPlayActivityAt ? new Date(data.lastPlayActivityAt) : null,
        );

        if (!readOnly) {
          writeLocalMirror(sessionId, teamId, {
            revealed: data.revealed,
            flagged: data.flagged,
            hearts: data.hearts,
            maxHearts: data.maxHearts,
            liesHit: data.liesHit,
            shielded: data.shielded,
            status: data.status,
            powerUps: data.powerUps,
            versesRestored: norm.restored,
            verseAssemblyIndices: norm.assembly,
          });
        }
      } catch {
        if (!cancelled) setError("Network error loading game state");
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, teamId, reloadKey, readOnly, gameSlug]);

  async function handleRetry() {
    if (passagesComplete) return;
    if (
      !confirm(
        "Start a fresh board? The minefield and passages reshuffle; hearts reset but your timer keeps running. Amazing Race codes you already redeemed stay unlocked — power-ups refresh for this run.",
      )
    ) {
      return;
    }
    setRetrying(true);
    setLastSolvedVerse(null);
    try {
      const res = await fetch("/api/unmasked/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, teamId, reset: true, slug: "unmasked" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showError(String(data.error ?? "Could not start a new board"));
        setRetrying(false);
        return;
      }
      clearLocalMirror(sessionId, teamId);
      setReloadKey((k) => k + 1);
    } finally {
      setRetrying(false);
    }
  }

  const persist = useCallback(
    async (updates: Record<string, unknown>) => {
      await fetch("/api/unmasked/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, teamId, ...updates }),
      });
    },
    [sessionId, teamId],
  );

  const schedulePersistAssembly = useCallback(
    (indices: number[]) => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
      persistTimer.current = setTimeout(() => {
        void persist({ verseAssemblyIndices: indices });
      }, 400);
    },
    [persist],
  );

  type ServerActionState = {
    revealed: number[];
    flagged: number[];
    hearts: number;
    maxHearts: number;
    liesHit: number;
    shielded: boolean;
    powerUps: { type: PowerUpType; used: boolean }[];
    status: "playing" | "won" | "lost";
    versesRestored?: string[];
    passagesComplete?: boolean;
    checkPassagePenaltySeconds?: number;
    verseAssemblyIndices?: number[];
  };

  /**
   * Loose shape covering every field downstream power-up/dev handlers read
   * from the `/action` response. Matches the union returned by
   * `applyPowerUp` + engine results without dragging those full types in.
   */
  type ActionResult = {
    type?: string;
    success?: boolean;
    reason?: string;
    revealedIndex?: number;
    revealedIndices?: number[];
    flaggedIndex?: number;
    peekedIndex?: number;
    peekedKind?: string;
    openingSize?: number;
    lineAxis?: "row" | "col";
    anchorIndex?: number;
  } | null;

  type ServerActionResponse = { result: ActionResult; state: ServerActionState };

  const applyServerState = useCallback(
    (s: ServerActionState) => {
      setRevealed(new Set(s.revealed));
      setFlagged(new Set(s.flagged));
      setHearts(s.hearts);
      setMaxHearts(s.maxHearts);
      setLiesHit(s.liesHit);
      setShielded(s.shielded);
      setPowerUps(s.powerUps);
      setStatus(s.status);
      if (Array.isArray(s.versesRestored)) setVersesRestored(s.versesRestored);
      if (typeof s.passagesComplete === "boolean") setPassagesComplete(s.passagesComplete);
      if (typeof s.checkPassagePenaltySeconds === "number") {
        setCheckPassagePenaltySeconds(s.checkPassagePenaltySeconds);
      }
      if (Array.isArray(s.verseAssemblyIndices)) {
        setVerseAssemblyIndices(s.verseAssemblyIndices);
      }
      if (!readOnly) {
        writeLocalMirror(sessionId, teamId, {
          revealed: s.revealed,
          flagged: s.flagged,
          hearts: s.hearts,
          maxHearts: s.maxHearts,
          liesHit: s.liesHit,
          shielded: s.shielded,
          status: s.status,
          powerUps: s.powerUps,
          versesRestored: s.versesRestored ?? latestStateRef.current.versesRestored,
          verseAssemblyIndices:
            s.verseAssemblyIndices ?? latestStateRef.current.verseAssemblyIndices,
        });
      }
    },
    [sessionId, teamId, readOnly],
  );

  /**
   * Enqueue a `/action` POST so concurrent clicks hit the server in order.
   * Resolves with the parsed response (or null on error). Callers decide
   * whether to `await` (blocking power-ups / dev tools) or fire-and-forget
   * (optimistic reveal/flag).
   */
  const enqueueServerAction = useCallback(
    (body: Record<string, unknown>): Promise<ServerActionResponse | null> => {
      pendingCountRef.current++;
      const next = actionQueueRef.current.then(async () => {
        try {
          const res = await fetch("/api/unmasked/action", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId, teamId, gameSlug, ...body }),
          });
          if (!res.ok) return null;
          return (await res.json()) as ServerActionResponse;
        } catch {
          return null;
        } finally {
          pendingCountRef.current--;
        }
      });
      actionQueueRef.current = next.then(
        () => undefined,
        () => undefined,
      );
      return next;
    },
    [sessionId, teamId, gameSlug],
  );

  /**
   * Blocking action: waits for the server, adopts its state, returns the
   * engine result. Used by power-ups, dev tools, and any action we don't
   * want to run locally (server-only RNG / settings).
   */
  const doActionServer = useCallback(
    async (
      action: string,
      index?: number,
      powerUpType?: PowerUpType,
      extra?: { axis?: "row" | "col" },
    ) => {
      const data = await enqueueServerAction({ action, index, powerUpType, ...extra });
      if (!data) return null;
      applyServerState(data.state);
      return data.result;
    },
    [enqueueServerAction, applyServerState],
  );

  /**
   * Compares the last-known optimistic state against the server snapshot and
   * adopts server state if they diverge. Skipped while more POSTs are in
   * flight (reconciling against a stale snapshot would cause flicker).
   */
  const maybeReconcile = useCallback(
    (s: ServerActionState) => {
      if (pendingCountRef.current > 0) return;
      const latest = latestStateRef.current;
      const diverged =
        latest.revealed.size !== s.revealed.length ||
        latest.flagged.size !== s.flagged.length ||
        latest.hearts !== s.hearts ||
        latest.liesHit !== s.liesHit ||
        latest.shielded !== s.shielded ||
        latest.status !== s.status;
      if (!diverged) return;
      applyServerState(s);
      showWarning("Synced with server", {
        description: "Reapplied authoritative game state.",
        duration: 3200,
      });
    },
    [applyServerState],
  );

  /**
   * Write the optimistic slice to state + mirror in one shot.
   * `slice` comes from the pure engine so it matches what the server will
   * compute once the enqueued POST lands.
   */
  const commitOptimistic = useCallback(
    (slice: OptimisticStateSlice) => {
      setRevealed(new Set(slice.revealed));
      setFlagged(new Set(slice.flagged));
      setHearts(slice.hearts);
      setLiesHit(slice.liesHit);
      setShielded(slice.shielded);
      setStatus(slice.status);
      const prev = latestStateRef.current;
      latestStateRef.current = {
        ...prev,
        revealed: new Set(slice.revealed),
        flagged: new Set(slice.flagged),
        hearts: slice.hearts,
        maxHearts: slice.maxHearts,
        liesHit: slice.liesHit,
        shielded: slice.shielded,
        powerUps: slice.powerUps.map((p) => ({ ...p })),
        status: slice.status,
      };
      if (!readOnly) {
        writeLocalMirror(sessionId, teamId, {
          revealed: slice.revealed,
          flagged: slice.flagged,
          hearts: slice.hearts,
          maxHearts: slice.maxHearts,
          liesHit: slice.liesHit,
          shielded: slice.shielded,
          status: slice.status,
          powerUps: slice.powerUps,
          versesRestored: prev.versesRestored,
          verseAssemblyIndices: prev.verseAssemblyIndices,
        });
      }
    },
    [sessionId, teamId, readOnly],
  );

  /**
   * Reveal a tile instantly on the client via the shared pure engine, then
   * sync to the server in the background. Returns the engine `RevealResult`
   * so callers can drive lie popups / flood-flash animations.
   */
  const doRevealOptimistic = useCallback(
    (index: number) => {
      if (!board) return null;
      const latest = latestStateRef.current;
      if (latest.status !== "playing") return { type: "game_over" as const };
      if (latest.revealed.has(index)) return { type: "already_revealed" as const };
      const { result, next } = applyRevealLocal(
        {
          board,
          revealed: latest.revealed,
          flagged: latest.flagged,
          hearts: latest.hearts,
          maxHearts: latest.maxHearts,
          liesHit: latest.liesHit,
          shielded: latest.shielded,
          powerUps: latest.powerUps,
          status: latest.status,
        },
        index,
      );
      if (
        result.type === "already_revealed" ||
        result.type === "flagged" ||
        result.type === "game_over"
      ) {
        return result;
      }
      commitOptimistic(next);
      void enqueueServerAction({ action: "reveal", index }).then((data) => {
        if (!data) return;
        maybeReconcile(data.state);
      });
      return result;
    },
    [board, commitOptimistic, enqueueServerAction, maybeReconcile],
  );

  /**
   * Toggle a flag instantly on the client, then sync to the server.
   * Returns the engine-reported flag state (true = now flagged), or null
   * if the toggle was rejected (game over / already revealed).
   */
  const doFlagOptimistic = useCallback(
    (index: number) => {
      if (!board) return null;
      const latest = latestStateRef.current;
      if (latest.status !== "playing") return null;
      const { changed, next, flaggedNow } = applyFlagLocal(
        {
          board,
          revealed: latest.revealed,
          flagged: latest.flagged,
          hearts: latest.hearts,
          maxHearts: latest.maxHearts,
          liesHit: latest.liesHit,
          shielded: latest.shielded,
          powerUps: latest.powerUps,
          status: latest.status,
        },
        index,
      );
      if (!changed) return null;
      commitOptimistic(next);
      void enqueueServerAction({ action: "flag", index }).then((data) => {
        if (!data) return;
        maybeReconcile(data.state);
      });
      return flaggedNow;
    },
    [board, commitOptimistic, enqueueServerAction, maybeReconcile],
  );

  const handleDevClearMinefield = useCallback(async () => {
    const r = await doActionServer("dev_reveal_all_safe");
    if (r == null) {
      showError("Could not clear minefield.");
      return;
    }
    showInfo("Dev: all safe tiles revealed (minefield cleared).");
  }, [doActionServer]);

  const doCheckVerse = useCallback(async () => {
    if (status !== "won") {
      showInfo("Clear the minefield first", {
        description: "Reveal every safe tile, then you can build and check passages.",
        duration: 4200,
      });
      return;
    }
    const res = await fetch("/api/unmasked/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        teamId,
        action: "check_verse",
        assemblyIndices: verseAssemblyIndices,
      }),
    });
    const data = await res.json();
    const s = data.state;
    if (s) {
      setVersesRestored(s.versesRestored ?? []);
      if (typeof s.passagesComplete === "boolean") setPassagesComplete(s.passagesComplete);
      if (typeof s.checkPassagePenaltySeconds === "number") {
        setCheckPassagePenaltySeconds(s.checkPassagePenaltySeconds);
      }
      setVerseAssemblyIndices(s.verseAssemblyIndices ?? []);
      const latest = latestStateRef.current;
      writeLocalMirror(sessionId, teamId, {
        revealed: [...latest.revealed],
        flagged: [...latest.flagged],
        hearts: latest.hearts,
        maxHearts: latest.maxHearts,
        liesHit: latest.liesHit,
        shielded: latest.shielded,
        status: latest.status,
        powerUps: latest.powerUps,
        versesRestored: s.versesRestored ?? [],
        verseAssemblyIndices: s.verseAssemblyIndices ?? [],
      });
    }
    const r = data.result;
    if (r?.ok) {
      const entry = getVerseByKey(r.verseKey);
      const reference = entry?.reference ?? "";
      const full = entry?.full ?? "";
      setLastSolvedVerse({
        reference,
        full,
      });
      showSuccess(reference ? `${reference} — passage restored!` : "Passage restored!", {
        duration: 5200,
      });
      if (s?.passagesComplete) {
        showSuccess("Every passage is correct — full run complete!", { duration: 6000 });
      }
      setTimeout(() => setLastSolvedVerse(null), 18000);
    } else if (r?.reason) {
      const added =
        typeof (r as { penaltySecondsAdded?: number }).penaltySecondsAdded === "number" ?
          (r as { penaltySecondsAdded: number }).penaltySecondsAdded
        : 0;
      const clue = (r as { referenceClue?: string }).referenceClue;
      showWarning(r.reason, {
        description:
          added > 0 ?
            `${clue ? `Clue — ${clue}. ` : ""}+${added}s added to your time.`
          : undefined,
        duration: 5200,
      });
    }
  }, [sessionId, teamId, verseAssemblyIndices, status]);

  function resetPowerUpIntent() {
    setActivePowerUp(null);
    setPendingAxisTile(null);
  }

  function showPowerUpMessage(message: string, duration = 3500) {
    showInfo(message, { duration });
  }

  async function handleTileClick(index: number) {
    if (readOnly) return;
    if (status !== "playing" || !board) return;

    if (activePowerUp === "truth_radar") {
      setPendingAxisTile(index);
      showPowerUpMessage("Truth Radar locked on. Choose Row or Column.");
      return;
    }

    if (activePowerUp === "verse_compass") {
      const result = await doActionServer("use_powerup", index, "verse_compass");
      resetPowerUpIntent();
      if (!result) return;
      if (result.success === false) {
        showPowerUpMessage(result.reason ?? "Verse Compass fizzled.", 4200);
        return;
      }
      const hits = Array.isArray(result.revealedIndices) ? result.revealedIndices : [];
      if (hits.length > 0) {
        flashTiles(hits, "verse_compass", 2200);
        showPowerUpMessage(
          hits.length === 1 ?
            "Verse Compass revealed 1 nearby fragment."
          : "Verse Compass revealed 2 nearby fragments.",
          2800,
        );
      }
      return;
    }

    if (activePowerUp === "lie_pin") {
      const result = await doActionServer("use_powerup", index, "lie_pin");
      resetPowerUpIntent();
      if (!result) return;
      if (result.success === false) {
        showPowerUpMessage(result.reason ?? "Lie Pin fizzled.", 4200);
        return;
      }
      if (typeof result.flaggedIndex === "number") {
        flashTiles([result.flaggedIndex], "lie_pin", 1800);
      }
      showPowerUpMessage("Nearest hidden lie was pinned from your focal tile.", 2800);
      return;
    }

    if (activePowerUp === "gentle_step") {
      const result = await doActionServer("use_powerup", index, "gentle_step");
      resetPowerUpIntent();
      if (!result) return;
      if (result.success === false) {
        showPowerUpMessage(result.reason ?? "Gentle Step fizzled.", 4200);
        return;
      }
      if (result.revealedIndex != null) {
        flashTiles([result.revealedIndex], "gentle_step", 1800);
      }
      showPowerUpMessage("Nearest safe square opened from your focal tile.", 2800);
      return;
    }

    if (activePowerUp === "scout") {
      const result = await doActionServer("use_powerup", index, "scout");
      resetPowerUpIntent();
      if (!result) return;
      if (result.success === false) {
        showPowerUpMessage(result.reason ?? "Scout fizzled.", 4000);
        return;
      }
      if (result.peekedIndex != null) {
        const kind = String(result.peekedKind ?? "truth");
        setScoutPeek({
          index: result.peekedIndex,
          kind,
        });
        setShimmerTile(result.peekedIndex);
        setTimeout(() => setShimmerTile(null), 1300);
        setTimeout(() => setScoutPeek(null), 3000);
        showPowerUpMessage(
          `Tile peeked: ${formatScoutPeekKind(kind)} — highlight fades in a few seconds.`,
          3800,
        );
      }
      return;
    }

    if (latestStateRef.current.revealed.has(index)) return;

    if (flagMode) {
      doFlagOptimistic(index);
      return;
    }

    const result = doRevealOptimistic(index);
    if (!result) return;
    if (
      result.type === "already_revealed" ||
      result.type === "flagged" ||
      result.type === "game_over"
    ) {
      return;
    }

    if (result.type === "lie") {
      const quoted = `“${result.text}”`;
      if (result.shieldUsed) {
        showSuccess(`Shield blocked: ${quoted}`, {
          duration: 4000,
          description: "Your shield protected you — no heart lost!",
        });
      } else {
        showWarning(`Lie revealed: ${quoted}`, {
          duration: 4000,
          description: "That's a lie about your identity. God says otherwise.",
        });
      }
      flashTiles([index], "truth_radar", 1800);
      return;
    }

    if ("floodRevealed" in result && Array.isArray(result.floodRevealed) && result.floodRevealed.length > 0) {
      flashTiles(result.floodRevealed, "reveal", 1600);
    }
  }

  function handleContextMenu(e: React.MouseEvent, index: number) {
    e.preventDefault();
    if (readOnly) return;
    if (ARMABLE_POWER_UPS.has(activePowerUp ?? "extra_heart")) return;
    if (status === "playing" && !revealed.has(index)) {
      doFlagOptimistic(index);
    }
  }

  async function handleRedeem() {
    if (!codeInput.trim()) return;
    const code = codeInput.trim().toUpperCase();
    const res = await fetch("/api/unmasked/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, teamId, code: codeInput.trim() }),
    });
    const data = await res.json();
    if (!res.ok) {
      showError(String(data.error ?? "Redeem failed"));
      return;
    }
    const type = data.powerUpType as PowerUpType;
    const name = POWER_UP_NAME[type] ?? type;
    const hint = POWER_UP_SHORT[type] ?? "";
    const applied = Boolean(data.applied);
    showSuccess(
      data.repaired ? `Recovered: ${name}` : `Unlocked: ${name}`,
      { description: hint },
    );
    setRedeemedCodes((prev) => [...prev, code]);
    if (applied) {
      // Auto-applied: add as `used` so the inventory reflects a consumed charge. Also mirror
      // the server-side side effect locally (hearts / shield) so the UI updates instantly.
      setPowerUps((prev) => [...prev, { type, used: true }]);
      if (type === "extra_heart") {
        setMaxHearts((m) => m + 1);
        setHearts((h) => h + 1);
      } else if (type === "shield") {
        setShielded(true);
      }
    } else {
      setPowerUps((prev) => [...prev, { type, used: false }]);
    }
    setCodeInput("");
  }

  async function handleUsePowerUp(type: PowerUpType) {
    if (ARMABLE_POWER_UPS.has(type)) {
      setActivePowerUp((prev) => (prev === type ? null : type));
      setPendingAxisTile(null);
      if (type === "truth_radar") {
        showPowerUpMessage("Truth Radar armed — tap a tile first, then choose Row or Column.");
      } else if (type === "verse_compass") {
        showPowerUpMessage("Verse Compass armed — tap an anchor tile.");
      } else if (type === "lie_pin") {
        showPowerUpMessage("Lie Pin armed — tap a focal tile (nearest hidden lie is pinned).");
      } else if (type === "gentle_step") {
        showPowerUpMessage("Gentle Step armed — tap a focal tile (nearest safe opens).");
      }
      return;
    }
    const result = await doActionServer("use_powerup", undefined, type);
    if (!result) return;
    if (result.success === false) {
      showPowerUpMessage(result.reason ?? `${POWER_UP_LABELS[type].label} fizzled.`, 4200);
      return;
    }
    if (type === "extra_heart") {
      showPowerUpMessage("+1 heart!", 2200);
      return;
    }
    if (type === "shield") {
      showPowerUpMessage("Shield up — your next lie is blocked.", 2600);
      return;
    }
    if (type === "reveal" && result.revealedIndex != null) {
      flashTiles([result.revealedIndex], "reveal", 1800);
      showPowerUpMessage("A safe area has been revealed!", 2400);
      return;
    }
    if (type === "safe_opening" && typeof result.openingSize === "number") {
      flashTiles(result.revealedIndex != null ? [result.revealedIndex] : [], "safe_opening", 2200);
      showPowerUpMessage(`Safe opening cleared ${result.openingSize} tiles!`, 3400);
      return;
    }
  }

  async function handleTruthRadarAxis(axis: "row" | "col") {
    if (pendingAxisTile == null) return;
    const result = await doActionServer("use_powerup", pendingAxisTile, "truth_radar", { axis });
    const origin = pendingAxisTile;
    resetPowerUpIntent();
    if (!result) return;
    if (result.success === false) {
      showPowerUpMessage(result.reason ?? "Truth Radar fizzled.", 4200);
      return;
    }
    const revealedIndices = Array.isArray(result.revealedIndices) ? result.revealedIndices : [];
    if (revealedIndices.length > 0) {
      flashTiles([origin, ...revealedIndices], "truth_radar", 2400);
      showSuccess(
        `Truth Radar revealed ${revealedIndices.length} truth${revealedIndices.length === 1 ? "" : "s"} on that ${axis}.`,
      );
    } else {
      showInfo(`No hidden truths were left on that ${axis}.`);
    }
  }

  const solvedSet = useMemo(() => new Set(versesRestored), [versesRestored]);

  const indicesSolvedAway = useMemo(() => {
    const next = new Set<number>();
    for (const f of verseFragments) {
      if (solvedSet.has(f.verseKey)) next.add(f.index);
    }
    return next;
  }, [verseFragments, solvedSet]);

  /** Revealed fragments still in play (not yet restored as a complete verse). */
  const availablePool = useMemo(() => {
    return verseFragments.filter(
      (f) => revealed.has(f.index) && !indicesSolvedAway.has(f.index),
    );
  }, [verseFragments, revealed, indicesSolvedAway]);

  /** Fixed permutation for the run: fragments in the stack follow this order (not verse/reading order). */
  const verseStackOrder = useMemo(() => {
    if (verseFragments.length === 0) return [];
    return seededShuffle(
      verseFragments.map((f) => f.index),
      layoutSeed,
    );
  }, [verseFragments, layoutSeed]);

  const bankIndices = useMemo(() => {
    const inAssembly = new Set(verseAssemblyIndices);
    const inBank = new Set(
      availablePool.filter((f) => !inAssembly.has(f.index)).map((f) => f.index),
    );
    return verseStackOrder.filter((idx) => inBank.has(idx));
  }, [availablePool, verseAssemblyIndices, verseStackOrder]);

  const assemblyFragments = useMemo(() => {
    return verseAssemblyIndices
      .map((i) => verseFragments.find((f) => f.index === i))
      .filter(Boolean) as VerseFragRow[];
  }, [verseAssemblyIndices, verseFragments]);

  const canAssembleVerses = status === "won" && !passagesComplete;

  function addToAssembly(tileIndex: number) {
    if (!canAssembleVerses) return;
    if (!availablePool.some((f) => f.index === tileIndex)) return;
    if (verseAssemblyIndices.includes(tileIndex)) return;
    const next = [...verseAssemblyIndices, tileIndex];
    setVerseAssemblyIndices(next);
    schedulePersistAssembly(next);
  }

  function removeFromAssembly(pos: number) {
    const next = verseAssemblyIndices.filter((_, i) => i !== pos);
    setVerseAssemblyIndices(next);
    schedulePersistAssembly(next);
  }

  function moveWithinAssembly(from: number, to: number) {
    const next = [...verseAssemblyIndices];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setVerseAssemblyIndices(next);
    schedulePersistAssembly(next);
  }

  const totalSafe = board ? board.gridSize * board.gridSize - board.totalLies : 0;
  const revealedSafe = board
    ? [...revealed].filter((i) => board.tiles[i]?.kind !== "lie").length
    : 0;
  const tilesRemaining = totalSafe - revealedSafe;
  const rawClockSeconds = Math.max(0, elapsed + checkPassagePenaltySeconds);
  const heartClockReductionSeconds =
    passagesComplete ? hearts * REMAINING_HEART_CLOCK_REDUCTION_SECONDS : 0;
  const displayedElapsed = Math.max(0, rawClockSeconds - heartClockReductionSeconds);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  /** Human-readable minutes total (e.g. spare-heart clock bonus). */
  const formatBonusMinutes = (totalSeconds: number) => {
    const m = totalSeconds / 60;
    if (m <= 0) return "0 min";
    if (Number.isInteger(m)) return `${m} min`;
    return `${m.toFixed(1)} min`;
  };

  const availablePowerUps = powerUps.filter((p) => !p.used);
  const availablePowerUpCounts = useMemo(() => {
    const counts = new Map<PowerUpType, number>();
    for (const pu of availablePowerUps) {
      counts.set(pu.type, (counts.get(pu.type) ?? 0) + 1);
    }
    return counts;
  }, [availablePowerUps]);

  /** Includes used charges — to tell "never unlocked" vs "all used up". */
  const totalPowerUpCounts = useMemo(() => {
    const counts = new Map<PowerUpType, number>();
    for (const pu of powerUps) {
      counts.set(pu.type, (counts.get(pu.type) ?? 0) + 1);
    }
    return counts;
  }, [powerUps]);
  /** Per-cell cap (rem) so huge boards stay readable; dense boards use up to ~58rem total width. */
  const cellRem = board ? Math.min(4, 58 / board.gridSize) : 3.625;

  const usedVerseKeys = useMemo(() => [...new Set(verseFragments.map((f) => f.verseKey))], [verseFragments]);

  const spectatorPaused = useMemo(() => {
    if (!readOnly || passagesComplete || status === "lost") return false;
    void readOnlyTick; // recompute when wall clock crosses idle threshold
    return (
      lastPlayActivityAt == null ||
      Date.now() - lastPlayActivityAt.getTime() >= LIVE_PLAY_MS
    );
  }, [readOnly, passagesComplete, status, lastPlayActivityAt, readOnlyTick]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading game...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
        {error}
      </div>
    );
  }

  if (!board) return null;

  return (
    <div className="space-y-5">
      {groupLabel ? (
        <p className="rounded-lg bg-primary/10 px-3 py-2 text-xs text-primary">
          Team: {groupLabel}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <div className="flex items-center gap-1">
          {Array.from({ length: maxHearts }, (_, i) => (
            <Heart
              key={i}
              className={`size-5 ${
                i < hearts
                  ? "fill-red-500 text-red-500"
                  : "fill-zinc-200 text-zinc-300 dark:fill-zinc-700 dark:text-zinc-600"
              }`}
            />
          ))}
          {shielded ? (
            <Shield className="ml-1 size-4 fill-amber-400 text-amber-500" />
          ) : null}
        </div>
        {passagesComplete && heartClockReductionSeconds > 0 ? (
          <span
            className="flex max-w-full flex-wrap items-baseline gap-x-1.5 gap-y-1 font-mono text-sm"
            title={`Actual ${formatTime(rawClockSeconds)} (includes +${checkPassagePenaltySeconds}s from wrong “Check passage” attempts). Spare hearts: −${formatBonusMinutes(heartClockReductionSeconds)} (${hearts} × ${REMAINING_HEART_CLOCK_REDUCTION_SECONDS / 60} min). Final ranked time ${formatTime(displayedElapsed)}.`}
          >
            <span className="tabular-nums text-muted-foreground">{formatTime(rawClockSeconds)}</span>
            <span className="font-sans text-[10px] font-normal uppercase tracking-wide text-muted-foreground">
              actual
            </span>
            <span className="text-muted-foreground/60" aria-hidden>
              ·
            </span>
            <span
              className="font-sans text-[11px] font-semibold text-emerald-700 dark:text-emerald-300"
              title={`${hearts} spare heart${hearts === 1 ? "" : "s"} × ${REMAINING_HEART_CLOCK_REDUCTION_SECONDS / 60} min each`}
            >
              −{formatBonusMinutes(heartClockReductionSeconds)}
            </span>
            <span className="text-muted-foreground/60" aria-hidden>
              ·
            </span>
            <span className="tabular-nums font-semibold text-foreground">{formatTime(displayedElapsed)}</span>
            <span className="font-sans text-[10px] font-normal uppercase tracking-wide text-muted-foreground">
              final
            </span>
          </span>
        ) : (
          <span
            className="font-mono text-muted-foreground"
            title={
              passagesComplete ?
                `Actual and final time (no spare-heart bonus). Wrong-check penalties: +${checkPassagePenaltySeconds}s.`
              : checkPassagePenaltySeconds > 0 ?
                `Clock time plus ${checkPassagePenaltySeconds}s from wrong “Check passage” attempts`
              : "Clock time for this run (including any passage penalties)"
            }
          >
            {formatTime(displayedElapsed)}
          </span>
        )}
        {readOnly && spectatorPaused ? (
          <span
            className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
            title="Clock is frozen until this team is active on the game again (recent play session)."
          >
            Timer paused
          </span>
        ) : null}
        <span className="text-muted-foreground">{tilesRemaining} tiles left</span>
        <span className="text-xs text-muted-foreground">
          Passages:{" "}
          {verseKeys.length > 0 ?
            `${verseKeys.filter((k) => versesRestored.includes(k)).length}/${verseKeys.length}`
          : "—"}
        </span>
        {passagesComplete ? (
          <span
            className={`inline-flex items-center gap-1 rounded-full border border-emerald-400/50 bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100 ${
              !readOnly ? "sm:ml-auto" : ""
            }`}
          >
            <Trophy className="size-3" />
            Complete!
          </span>
        ) : status === "won" ? (
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
            Minefield clear
          </span>
        ) : status === "lost" ? (
          <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800 dark:bg-red-950 dark:text-red-200">
            Game Over
          </span>
        ) : null}
        {!readOnly && !passagesComplete ? (
          <button
            type="button"
            onClick={() => void handleRetry()}
            disabled={retrying}
            className="ui-button-secondary inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-foreground shadow-sm disabled:opacity-50 sm:ml-auto"
          >
            <RotateCcw className={`size-3.5 ${retrying ? "animate-spin" : ""}`} />
            {retrying ? "Shuffling…" : "New board"}
          </button>
        ) : readOnly ? (
          <span className="ml-auto text-[11px] text-muted-foreground">View only</span>
        ) : null}
      </div>

      {!readOnly && status === "playing" ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setFlagMode(!flagMode);
              resetPowerUpIntent();
            }}
            className={`inline-flex touch-manipulation items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition max-lg:fixed max-lg:right-4 max-lg:z-50 max-lg:shadow-lg max-lg:ring-1 max-lg:ring-border/60 max-lg:backdrop-blur-sm max-lg:[bottom:max(1rem,env(safe-area-inset-bottom))] lg:static lg:shadow-none lg:ring-0 lg:backdrop-blur-none ${
              flagMode
                ? "border-amber-400 bg-amber-50 text-amber-800 dark:border-amber-600 dark:bg-amber-950 dark:text-amber-200 max-lg:bg-amber-50/95 dark:max-lg:bg-amber-950/95"
                : "border-border bg-background text-muted-foreground hover:bg-muted max-lg:bg-background/95"
            }`}
          >
            <Flag className="size-3.5" />
            {flagMode ? "Flag mode ON" : "Flag mode"}
          </button>
          {activePowerUp ? (
            <>
              <span className="text-xs text-primary">
                {activePowerUp === "scout" ?
                  "Scout armed — tap a hidden tile to peek."
                : activePowerUp === "truth_radar" && pendingAxisTile == null ?
                  "Truth Radar armed — tap a tile first."
                : activePowerUp === "truth_radar" ?
                  "Truth Radar locked — now choose Row or Column."
                : activePowerUp === "verse_compass" ?
                  "Verse Compass armed — tap an anchor tile."
                : activePowerUp === "lie_pin" ?
                  "Lie Pin armed — tap your focal tile."
                : activePowerUp === "gentle_step" ?
                  "Gentle Step armed — tap your focal tile."
                : `Tap a tile to use ${POWER_UP_LABELS[activePowerUp]?.label}`}
              </span>
              <button
                type="button"
                onClick={resetPowerUpIntent}
                className="rounded-md border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      {!readOnly && scoutPeek ? (
        <div className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">
          Tile peeked: {formatScoutPeekKind(scoutPeek.kind)} — fading in 3s...
        </div>
      ) : null}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:gap-4">
        <aside
          className={`order-2 w-full max-w-full lg:order-1 lg:w-36 lg:max-w-[9.5rem] lg:shrink-0 ${readOnly ? "pointer-events-none opacity-95" : ""}`}
        >
          <div className="ui-card-muted rounded-xl p-2 sm:p-2.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-foreground">Power-ups</p>
              {!readOnly ? (
                <span className="text-[11px] text-muted-foreground">Long-press for tip</span>
              ) : (
                <span className="text-[11px] text-muted-foreground">Inventory</span>
              )}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-1 lg:gap-1">
              {ALL_POWER_UP_TYPES.map((type) => {
                const info = POWER_UP_LABELS[type];
                const Icon = info.icon;
                const count = availablePowerUpCounts.get(type) ?? 0;
                const totalEver = totalPowerUpCounts.get(type) ?? 0;
                const isUsedUp = totalEver > 0 && count === 0;
                const isReady = count > 0 && status === "playing";
                const isActive = activePowerUp === type;
                const title =
                  isReady ? POWER_UP_HINT[type]
                  : isUsedUp ? "All charges used for this power-up on this board."
                  : `${POWER_UP_HINT[type]} Redeem a code to unlock.`;
                const showTip = tipPowerUp === type;
                return (
                  <div key={type} className="group relative min-w-0">
                    <div title={title}>
                      <button
                        type="button"
                        onClick={() => isReady && void handleUsePowerUp(type)}
                        onPointerDown={() => startPowerUpTip(type)}
                        onPointerUp={cancelPowerUpTip}
                        onPointerLeave={cancelPowerUpTip}
                        onPointerCancel={cancelPowerUpTip}
                        disabled={!isReady}
                        className={`relative flex w-full items-center gap-1.5 rounded-lg border px-2 py-1.5 text-left text-[11px] leading-tight transition ${
                          isActive ?
                            "border-primary/50 bg-primary/10 text-primary shadow-sm"
                          : isReady ?
                            "border-border bg-card text-foreground hover:bg-muted"
                          : isUsedUp ?
                            "border-border/60 bg-muted/40 text-muted-foreground opacity-90"
                          : "border-border/70 bg-card/70 text-muted-foreground/80 blur-[0.6px] grayscale"
                        }`}
                      >
                        <span
                          className={`inline-flex size-7 shrink-0 items-center justify-center rounded-md ${
                            isReady ? "bg-primary/10 text-primary" : isUsedUp ? "bg-muted/80 text-muted-foreground" : "bg-muted text-muted-foreground"
                          }`}
                        >
                          <Icon className={`size-3.5 ${isUsedUp ? "opacity-55" : ""}`} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span
                            className={`block truncate font-medium ${isUsedUp ? "line-through decoration-muted-foreground/80" : ""}`}
                          >
                            {info.label}
                          </span>
                          <span className="block truncate text-[10px] text-muted-foreground">
                            {isReady ? "Ready to use" : isUsedUp ? "Used" : "Locked"}
                          </span>
                        </span>
                        {count > 0 ? (
                          <span className="rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-semibold text-primary-foreground">
                            {count}
                          </span>
                        ) : null}
                      </button>
                    </div>
                    {showTip ? (
                      <div
                        role="tooltip"
                        className="absolute left-0 right-0 top-full z-20 mt-1 rounded-md border border-border bg-card/95 p-2 text-[10.5px] leading-snug text-foreground shadow-lg backdrop-blur"
                      >
                        {POWER_UP_SHORT[type]}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </aside>

        <div className="order-1 min-w-0 flex-1 lg:order-2">
          <div
            role="status"
            aria-live="polite"
            className="mx-auto mb-2 flex min-h-[1.75rem] max-w-full items-center justify-center text-center text-[11px] font-medium"
          >
            {!readOnly && activePowerUp ? (
              <span className="rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-primary">
                {activePowerUp === "truth_radar" && pendingAxisTile != null
                  ? "Now choose Row or Column."
                  : POWER_UP_ARMED_BANNER[activePowerUp]}
              </span>
            ) : null}
          </div>
          <div
            ref={gridContainerRef}
            className={`relative w-full rounded-xl bg-emerald-50/95 p-0 ring-1 ring-emerald-900/10 dark:ring-emerald-100/25 sm:p-1.5 ${
              flagMode ? "ring-2 ring-amber-400/70" : ""
            }`}
          >
          <div
            className={`unmasked-board mx-auto grid w-full gap-px rounded-md p-0.5 transition sm:gap-0.5 ${
              readOnly ? "pointer-events-none" : ""
            } ${
              flagMode
                ? "bg-amber-100/50 ring-2 ring-amber-300/80"
                : "bg-transparent ring-0"
            }`}
            style={{
              gridTemplateColumns: `repeat(${board.gridSize}, minmax(0, 1fr))`,
              maxWidth: `min(100%, min(96vw, ${board.gridSize * cellRem}rem))`,
            }}
          >
            {board.tiles.map((tile, i) => {
          const isRevealed = revealed.has(i);
          const isFlagged = flagged.has(i);
          const isScoutPeek = scoutPeek?.index === i;
          const isLie = tile.kind === "lie";
          const isVerse = tile.kind === "verse";
          const isHighlighted = highlightedTiles.has(i);
          const isTruthRadarOrigin = activePowerUp === "truth_radar" && pendingAxisTile === i;
          const isShimmer = shimmerTile === i;
          const needsFocalTileFromGrid =
            status === "playing" &&
            (activePowerUp === "truth_radar" && pendingAxisTile == null ?
              true
            : activePowerUp === "verse_compass" ||
              activePowerUp === "lie_pin" ||
              activePowerUp === "gentle_step");
          /** Primary ring only on hover/active so armed power-ups do not paint the whole board. */
          const focalRevealHover =
            "ring-0 transition-[box-shadow,background-color] hover:ring-1 hover:ring-primary/40 hover:ring-offset-0 hover:bg-primary/5 active:ring-2 active:ring-primary/50";

          if (isRevealed) {
            if (isLie) {
              const cls = `flex aspect-square min-h-0 items-center justify-center rounded-sm text-[0.65rem] sm:text-xs ${
                isHighlighted && highlightMode === "truth_radar" ?
                  "animate-pulse border border-red-400 bg-red-200"
                : "border border-red-200/90 bg-red-100"
              } ${needsFocalTileFromGrid ? focalRevealHover : ""}`;
              return needsFocalTileFromGrid ? (
                <button
                  key={i}
                  ref={tileRefSetters[i]}
                  type="button"
                  disabled={status !== "playing"}
                  onClick={() => void handleTileClick(i)}
                  className={cls}
                  title={tile.lieText}
                >
                  <span className={`${isHighlighted ? "animate-bounce" : ""} text-red-600`}>X</span>
                </button>
              ) : (
                <div
                  key={i}
                  ref={tileRefSetters[i]}
                  className={cls}
                  title={tile.lieText}
                >
                  <span className={`${isHighlighted ? "animate-bounce" : ""} text-red-600`}>X</span>
                </div>
              );
            }
            if (isVerse) {
              const cls = `verse-magic-tile relative flex aspect-square min-h-0 items-center justify-center overflow-hidden rounded-sm border-2 border-amber-200/80 ${
                isHighlighted && highlightMode === "verse_compass" ?
                  "ring-2 ring-violet-400 ring-offset-1 ring-offset-emerald-50"
                : ""
              } ${needsFocalTileFromGrid ? `${focalRevealHover} hover:ring-2` : ""}`;
              const verseClue =
                tile.adjacentLies > 0 ? (
                  <span
                    className={`relative z-10 text-[0.75rem] font-bold tabular-nums drop-shadow-[0_1px_1px_rgba(255,255,255,0.85)] sm:text-sm ${numberColor(tile.adjacentLies)}`}
                  >
                    {tile.adjacentLies}
                  </span>
                ) : (
                  <Sparkles
                    className="relative z-10 size-4 text-amber-50 opacity-95 drop-shadow-[0_0_8px_rgba(250,232,255,0.95)] sm:size-[1.15rem]"
                    strokeWidth={2}
                  />
                );
              return needsFocalTileFromGrid ? (
                <button
                  key={i}
                  ref={tileRefSetters[i]}
                  type="button"
                  disabled={status !== "playing"}
                  onClick={() => void handleTileClick(i)}
                  className={cls}
                  title="Passage tile — number shows adjacent lies"
                >
                  <Sparkles
                    className="pointer-events-none absolute right-0.5 top-0.5 z-0 size-2.5 opacity-55 text-white"
                    aria-hidden
                  />
                  {verseClue}
                </button>
              ) : (
                <div
                  key={i}
                  ref={tileRefSetters[i]}
                  className={cls}
                  title="Passage tile — number shows adjacent lies"
                >
                  <Sparkles
                    className="pointer-events-none absolute right-0.5 top-0.5 z-0 size-2.5 opacity-55 text-white"
                    aria-hidden
                  />
                  {verseClue}
                </div>
              );
            }
            const cls = `flex aspect-square min-h-0 items-center justify-center rounded-sm border border-transparent bg-white ${
              isHighlighted && (highlightMode === "reveal" || highlightMode === "safe_opening" || highlightMode === "gentle_step") ?
                "animate-pulse border border-emerald-400 bg-emerald-100"
              : ""
            } ${needsFocalTileFromGrid ? focalRevealHover : ""}`;
            return needsFocalTileFromGrid ? (
              <button
                key={i}
                ref={tileRefSetters[i]}
                type="button"
                disabled={status !== "playing"}
                onClick={() => void handleTileClick(i)}
                className={cls}
              >
                {tile.adjacentLies > 0 ? (
                  <span
                    className={`text-[0.65rem] font-bold sm:text-xs ${numberColor(tile.adjacentLies)}`}
                  >
                    {tile.adjacentLies}
                  </span>
                ) : null}
              </button>
            ) : (
              <div
                key={i}
                ref={tileRefSetters[i]}
                className={cls}
              >
                {tile.adjacentLies > 0 ? (
                  <span
                    className={`text-[0.65rem] font-bold sm:text-xs ${numberColor(tile.adjacentLies)}`}
                  >
                    {tile.adjacentLies}
                  </span>
                ) : null}
              </div>
            );
          }

          return (
            <button
              key={i}
              ref={tileRefSetters[i]}
              type="button"
              onClick={() => void handleTileClick(i)}
              onContextMenu={(e) => handleContextMenu(e, i)}
              disabled={status !== "playing"}
              className={`flex aspect-square min-h-0 items-center justify-center rounded-sm border text-[0.65rem] font-medium transition sm:text-xs ${
                isScoutPeek
                  ? scoutPeek.kind === "lie"
                    ? "border-red-400 bg-red-100"
                  : scoutPeek.kind === "verse"
                    ? "border-amber-400 bg-amber-100"
                    : "border-emerald-400 bg-emerald-100"
                  : isHighlighted && highlightMode === "lie_pin"
                    ? "animate-pulse border-rose-500 bg-rose-100"
                  : isTruthRadarOrigin
                    ? "border-primary bg-primary/10 ring-2 ring-primary/40"
                  : (activePowerUp === "scout" ||
                      activePowerUp === "verse_compass" ||
                      activePowerUp === "truth_radar" ||
                      activePowerUp === "lie_pin" ||
                      activePowerUp === "gentle_step") &&
                      !isFlagged
                    ? "border-zinc-300 bg-zinc-100/95 ring-0 transition-[box-shadow,background-color,border-color] hover:border-primary/50 hover:ring-1 hover:ring-primary/30 hover:bg-white active:border-primary active:ring-2 active:ring-primary/45"
                    : isShimmer
                      ? "animate-pulse border-primary/50 bg-primary/10"
                    : isFlagged
                      ? "border-rose-400/80 bg-rose-100"
                      : "border-zinc-300 bg-zinc-100/95 hover:bg-zinc-200/90"
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {isFlagged ? (
                <Flag className="size-2.5 text-rose-600 sm:size-3.5" />
              ) : isScoutPeek ? (
                <Eye className="size-2.5 sm:size-3.5" />
              ) : null}
            </button>
          );
            })}
          </div>
          {!readOnly &&
          activePowerUp === "truth_radar" &&
          pendingAxisTile != null &&
          board ? (
            <TruthRadarChooser
              anchor={tileRefs.current.get(pendingAxisTile) ?? null}
              gridContainer={gridContainerRef.current}
              row={Math.floor(pendingAxisTile / board.gridSize)}
              col={pendingAxisTile % board.gridSize}
              gridSize={board.gridSize}
              onChoose={(axis) => void handleTruthRadarAxis(axis)}
              onCancel={resetPowerUpIntent}
            />
          ) : null}
          </div>
        </div>
      </div>

      <div className="min-h-[6.5rem] sm:min-h-[5.5rem]">
        {status === "lost" || passagesComplete ? (
          <div
            className={`rounded-xl border p-4 text-sm ${
              passagesComplete
                ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100"
                : "border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-100"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold">
                  {passagesComplete ? "You finished the full run!" : "Game over."}{" "}
                  <span className="font-normal opacity-80">
                    {passagesComplete ?
                      heartClockReductionSeconds > 0 ?
                        `Actual ${formatTime(rawClockSeconds)} · spare hearts −${formatBonusMinutes(heartClockReductionSeconds)} · final ${formatTime(displayedElapsed)} · ${hearts}/${maxHearts} hearts · ${liesHit} lies hit.`
                      : `Time ${formatTime(rawClockSeconds)} · ${hearts}/${maxHearts} hearts · ${liesHit} lies hit.`
                    : "All hearts lost. The board above shows what was hidden."}
                  </span>
                </p>
              </div>
              {!readOnly && status === "lost" ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void handleRetry()}
                    disabled={retrying}
                    className="ui-button-secondary inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                  >
                    <RotateCcw className={`size-3.5 ${retrying ? "animate-spin" : ""}`} />
                    {retrying ? "Shuffling…" : "New board"}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {!readOnly && status === "playing" ? (
        <div className="ui-card-muted rounded-xl p-4">
          <p className="text-xs font-semibold text-foreground">Power-Up Codes</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Enter codes earned from Amazing Race stations.
          </p>
          <div className="mt-3 flex gap-2">
            <input
              type="text"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void handleRedeem()}
              placeholder="Enter code..."
              className="ui-field flex-1 rounded-lg px-3 py-2 text-sm uppercase"
            />
            <button
              type="button"
              onClick={() => void handleRedeem()}
              className="ui-button rounded-lg px-4 py-2 text-sm font-medium"
            >
              Redeem
            </button>
          </div>
          {redeemedCodes.length > 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Redeemed: {redeemedCodes.join(", ")}
            </p>
          ) : null}
        </div>
      ) : null}

      {!readOnly &&
      !passagesComplete &&
      (availablePool.length > 0 ||
        assemblyFragments.length > 0 ||
        versesRestored.length > 0) ? (
        <div className="overflow-hidden rounded-2xl border border-amber-200/90 bg-gradient-to-b from-amber-50/95 to-amber-50/70 shadow-sm dark:border-amber-800/80 dark:from-amber-950/55 dark:to-amber-950/35">
          <div className="border-b border-amber-200/70 bg-amber-100/45 px-4 py-3.5 dark:border-amber-800/50 dark:bg-amber-950/45">
            <p className="text-sm font-semibold tracking-tight text-amber-950 dark:text-amber-50">
              Passage fragments
            </p>
            <p className="mt-1.5 max-w-prose text-xs leading-relaxed text-amber-900/88 dark:text-amber-200/88">
              Color = same passage. After the minefield is cleared, tap fragments to add them in reading order, then{" "}
              <strong>Check passage</strong>. Each wrong check for the passage you are building adds{" "}
              {CHECK_PASSAGE_WRONG_PENALTY_SECONDS}s to your time and shows a <strong>citation clue</strong> (e.g. John
              3:16) for that passage.
            </p>
          </div>

          <div className="space-y-4 p-4">
            {!canAssembleVerses ? (
              <p className="rounded-xl border border-amber-300/55 bg-amber-100/70 px-3 py-2 text-[11px] font-medium leading-snug text-amber-950 dark:border-amber-700/60 dark:bg-amber-950/55 dark:text-amber-100">
                Builder locked until the board is cleared (all safe tiles revealed).
              </p>
            ) : null}
            {usedVerseKeys.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                {usedVerseKeys.map((vk, i) => {
                  const palette = VERSE_PALETTE[verseColorIndex(vk, usedVerseKeys)];
                  const solved = solvedSet.has(vk);
                  return (
                    <span
                      key={vk}
                      className={`inline-flex max-w-full flex-wrap items-center gap-x-1.5 gap-y-0.5 rounded-full border border-amber-200/50 px-2.5 py-1 text-[10px] font-semibold shadow-sm dark:border-amber-800/40 ${palette.bg} ${palette.text} ${solved ? "opacity-60" : ""}`}
                      title={solved ? "Restored in correct order" : "Not yet restored"}
                    >
                      <span className={`size-2 shrink-0 rounded-full ${palette.chip}`} aria-hidden />
                      <span className="whitespace-nowrap">Passage {i + 1}</span>
                      <span className="font-bold opacity-95">{solved ? "· solved" : "· pending"}</span>
                    </span>
                  );
                })}
              </div>
            ) : null}
            {lastSolvedVerse ? (
              <div className="rounded-xl border border-emerald-300/70 bg-emerald-50/90 px-3 py-2.5 text-sm text-emerald-950 shadow-sm dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-50">
                {lastSolvedVerse.reference ? (
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
                    {lastSolvedVerse.reference}
                  </p>
                ) : null}
                <p className="mt-1 font-medium leading-relaxed">&ldquo;{lastSolvedVerse.full}&rdquo;</p>
              </div>
            ) : null}

            <div>
              <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                Stack
              </p>
              <div className="mt-2 min-h-[2.75rem] rounded-xl border border-amber-200/70 bg-white/55 p-2.5 dark:border-amber-800/55 dark:bg-amber-950/35">
                <div className="flex flex-wrap gap-2">
                  {bankIndices.length === 0 && assemblyFragments.length === 0 ? (
                    <span className="text-xs leading-relaxed text-amber-700 dark:text-amber-400">
                      Reveal enchanted passage tiles on the board to collect lines.
                    </span>
                  ) : null}
                  {bankIndices.map((idx) => {
                    const frag = verseFragments.find((f) => f.index === idx);
                    if (!frag) return null;
                    const palette = VERSE_PALETTE[verseColorIndex(frag.verseKey, usedVerseKeys)];
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => addToAssembly(idx)}
                        className={`max-w-full rounded-lg border px-2.5 py-1.5 text-left text-[0.7rem] font-medium shadow-sm transition hover:brightness-[0.98] active:scale-[0.99] disabled:opacity-50 dark:hover:brightness-110 ${palette.bg} ${palette.text} ${palette.ring}`}
                      >
                        {frag.text}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                  Builder row
                </p>
                {assemblyFragments.length > 1 ? (
                  <span className="text-[10px] text-amber-700/90 dark:text-amber-400/90">
                    Use ↑ ↓ to reorder · tap a line to return it to the stack
                  </span>
                ) : (
                  <span className="text-[10px] text-amber-700/90 dark:text-amber-400/90">
                    Tap a line to return it to the stack
                  </span>
                )}
              </div>
              <div className="mt-2 min-h-[2.75rem] rounded-xl border border-amber-200/70 bg-white/55 p-2.5 dark:border-amber-800/55 dark:bg-amber-950/35">
                {assemblyFragments.length === 0 ? (
                  <span className="text-xs leading-relaxed text-amber-700 dark:text-amber-400">
                    Add phrases from the stack in the order you think is right.
                  </span>
                ) : (
                  <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2">
                    {assemblyFragments.map((frag, i) => {
                      const palette = VERSE_PALETTE[verseColorIndex(frag.verseKey, usedVerseKeys)];
                      const last = i === assemblyFragments.length - 1;
                      return (
                        <div key={`${frag.index}-${i}`} className="flex items-center gap-1.5">
                          {i > 0 ? (
                            <ChevronRight
                              className="size-4 shrink-0 text-amber-400/75 dark:text-amber-500/45"
                              aria-hidden
                            />
                          ) : null}
                          <div
                            className={`flex max-w-full min-w-0 overflow-hidden rounded-xl border shadow-sm ${palette.ring} bg-white/90 dark:bg-amber-950/50`}
                          >
                            <div className="flex shrink-0 flex-col self-stretch border-r border-amber-200/70 dark:border-amber-800/60">
                              <button
                                type="button"
                                disabled={i === 0 || !canAssembleVerses}
                                onClick={() => moveWithinAssembly(i, i - 1)}
                                className="flex min-h-[1.5rem] flex-1 items-center justify-center px-1 text-amber-700 transition hover:bg-amber-100/90 disabled:cursor-not-allowed disabled:opacity-25 dark:text-amber-300 dark:hover:bg-amber-900/50"
                                title="Earlier in sentence"
                                aria-label="Move fragment earlier in sentence"
                              >
                                <ChevronUp className="size-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={last || !canAssembleVerses}
                                onClick={() => moveWithinAssembly(i, i + 1)}
                                className="flex min-h-[1.5rem] flex-1 items-center justify-center px-1 text-amber-700 transition hover:bg-amber-100/90 disabled:cursor-not-allowed disabled:opacity-25 dark:text-amber-300 dark:hover:bg-amber-900/50"
                                title="Later in sentence"
                                aria-label="Move fragment later in sentence"
                              >
                                <ChevronDown className="size-3.5" />
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeFromAssembly(i)}
                              className={`min-w-0 flex-1 px-2.5 py-1.5 text-left text-[0.7rem] font-medium leading-snug ${palette.bg} ${palette.text}`}
                              title="Back to stack"
                            >
                              {frag.text}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {assemblyFragments.length > 0 ? (
              <button
                type="button"
                onClick={() => void doCheckVerse()}
                disabled={!canAssembleVerses}
                className="w-full rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-500 sm:w-auto disabled:cursor-not-allowed disabled:opacity-50"
              >
                Check passage
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {readOnly && redeemedCodes.length > 0 ? (
        <div className="ui-card-muted rounded-xl p-4 text-xs text-foreground">
          <p className="font-semibold">Codes redeemed (Amazing Race)</p>
          <p className="mt-1 font-mono text-muted-foreground">{redeemedCodes.join(", ")}</p>
        </div>
      ) : null}

      {readOnly && verseKeys.length > 0 ? (
        <div className="ui-card-muted rounded-xl p-4 text-xs text-foreground">
          <p className="font-semibold">Passage progress</p>
          <p className="mt-1 text-muted-foreground">
            Restored: {verseKeys.filter((k) => versesRestored.includes(k)).length}/{verseKeys.length}
            {verseAssemblyIndices.length > 0 ?
              ` · ${verseAssemblyIndices.length} fragment(s) in builder`
            : ""}
            {passagesComplete ? " · All passages complete" : ""}
          </p>
        </div>
      ) : null}

      {!readOnly ? (
      <div className="ui-card-muted rounded-xl p-4 text-xs leading-relaxed text-foreground">
        <p className="font-semibold text-foreground">How to play</p>
        <ul className="mt-2 list-inside list-disc space-y-1.5">
          <li>Tap a tile to open it. Numbers = lies nearby.</li>
          <li>
            <strong>Flag mode</strong> tags suspected lies (or right-click on desktop).
          </li>
          <li>Hitting a lie costs 1 heart. 0 hearts = game over.</li>
          <li>
            Glowing tiles hide passage fragments; same color = same passage. After the minefield is clear, build each
            passage in order and <strong>Check passage</strong> until every passage is correct. A wrong check adds{" "}
            {CHECK_PASSAGE_WRONG_PENALTY_SECONDS}s to your clock and reveals which Scripture the passage is from. The run
            only counts as finished when all passages are solved.
          </li>
          <li>
            Earn power-up codes from camp stations and redeem them above.
          </li>
        </ul>
        <p className="mt-3 rounded-md bg-primary/10 px-3 py-2 text-[11px] text-primary">
          <strong>Tip:</strong> The header timer tracks your run across boards (it does not reset on a new minefield).
          When you finish every passage, the header shows your <strong>actual</strong> time first, then{" "}
          <strong>−{REMAINING_HEART_CLOCK_REDUCTION_SECONDS / 60} min</strong> per spare heart you finished with, then
          your <strong>final</strong> ranked time (actual minus that bonus).
        </p>
      </div>
      ) : null}

      {process.env.NODE_ENV === "development" && !readOnly ? (
        <button
          type="button"
          onClick={() => void handleDevClearMinefield()}
          className="fixed bottom-5 right-5 z-[100] flex items-center gap-2 rounded-full border-2 border-dashed border-amber-600/80 bg-amber-100/95 px-3 py-2 text-xs font-semibold text-amber-950 shadow-lg backdrop-blur-sm hover:bg-amber-200/95 dark:border-amber-400/70 dark:bg-amber-950/95 dark:text-amber-50 dark:hover:bg-amber-900/95"
          title="Development only: reveal every safe tile (does not auto-reveal lies)"
          aria-label="Development: clear minefield — reveal all safe tiles"
        >
          <Bomb className="size-4 shrink-0" aria-hidden />
          Dev: clear minefield
        </button>
      ) : null}
    </div>
  );
}
