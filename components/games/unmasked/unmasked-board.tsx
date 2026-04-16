"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
} from "lucide-react";
import {
  generateBoard,
  sortPersistedFragmentsForBoard,
  type Board,
} from "@/lib/games/unmasked/engine";
import { getVerseByKey } from "@/lib/games/unmasked/verses";
import type { PowerUpType } from "@/lib/db/models";

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
  verseScore?: number;
  verseCompleted?: boolean;
  redeemedCodes: string[];
  powerUps: { type: PowerUpType; used: boolean }[];
  shielded: boolean;
  status: "playing" | "won" | "lost";
  liesHit: number;
  startedAt: string;
  finishedAt?: string;
};

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

/** Short hints for redeem UI (20×20 + ~28% lies = need clarity). */
const POWER_UP_HINTS: Record<PowerUpType, string> = {
  extra_heart: "Tap once — +1 max heart and refill one heart.",
  reveal:
    "Tap once per charge — flood-reveals one random hidden safe tile. Each redeemed Reveal code grants 5 charges.",
  scout: "Arm, then tap a hidden tile — peek lie vs truth only. Using it still spends the charge even if it fizzles.",
  shield: "Tap once — next lie you hit is blocked (no heart lost).",
  safe_opening:
    "Tap once — auto-opens the best zero-adjacent patch. If no opening qualifies, the charge still burns.",
  truth_radar:
    "Arm, tap a tile, then pick Row or Column — reveals the nearest lie on that line without heart loss.",
  lie_pin:
    "Arm, tap a focal tile — pins the nearest hidden lie to that point. If none remain, it fizzles and still spends the charge.",
  verse_compass:
    "Arm, tap an anchor tile — reveals up to two nearest hidden verse fragments from there.",
  gentle_step:
    "Arm, tap a focal tile — reveals the nearest hidden safe square only. No spread, no chain reaction.",
};

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

function numberColor(n: number): string {
  const colors = [
    "",
    "text-blue-600 dark:text-blue-400",
    "text-green-600 dark:text-green-400",
    "text-red-600 dark:text-red-400",
    "text-purple-700 dark:text-purple-400",
    "text-orange-700 dark:text-orange-400",
    "text-teal-600 dark:text-teal-400",
    "text-zinc-700 dark:text-zinc-300",
    "text-zinc-500",
  ];
  return colors[n] ?? "text-zinc-600";
}

function normalizeLoadedState(data: PersistedState): {
  verseKeys: string[];
  verseFragments: VerseFragRow[];
  assembly: number[];
  restored: string[];
  score: number;
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
  const score =
    data.verseScore ??
    (data.verseCompleted && legacyKey ?
      frags.filter((f) => f.verseKey === legacyKey).length
    : 0);
  return { verseKeys: keys, verseFragments: frags, assembly, restored, score };
}

export function UnmaskedBoard({
  sessionId,
  teamId,
  groupLabel,
  gameSlug = "unmasked",
}: {
  sessionId: string;
  teamId: string;
  groupLabel?: string;
  /** Game definition slug (for Unmasked settings like safe-opening minimum). */
  gameSlug?: string;
  settings?: Record<string, unknown>;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [retrying, setRetrying] = useState(false);

  const [board, setBoard] = useState<Board | null>(null);
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
  const [verseScore, setVerseScore] = useState(0);
  const [redeemedCodes, setRedeemedCodes] = useState<string[]>([]);
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const [codeInput, setCodeInput] = useState("");
  const [codeMsg, setCodeMsg] = useState("");
  const [verseMsg, setVerseMsg] = useState("");
  const [lastSolvedText, setLastSolvedText] = useState<string | null>(null);
  const [activePowerUp, setActivePowerUp] = useState<PowerUpType | null>(null);
  const [scoutPeek, setScoutPeek] = useState<{ index: number; kind: string } | null>(null);
  const [liePopup, setLiePopup] = useState<{ text: string; shieldUsed: boolean } | null>(null);
  const [flagMode, setFlagMode] = useState(false);
  const [pendingAxisTile, setPendingAxisTile] = useState<number | null>(null);
  const [highlightedTiles, setHighlightedTiles] = useState<Set<number>>(new Set());
  const [highlightMode, setHighlightMode] = useState<
    "reveal" | "safe_opening" | "truth_radar" | "lie_pin" | "verse_compass" | "gentle_step" | null
  >(null);
  const [shimmerTile, setShimmerTile] = useState<number | null>(null);

  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    if (status !== "playing" || !startedAt) return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [status, startedAt]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/unmasked/state?sessionId=${sessionId}&teamId=${teamId}&slug=unmasked`,
        );
        if (cancelled) return;
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          setError(String(d.error ?? "Failed to load"));
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
        setVerseScore(norm.score);
        setRedeemedCodes(data.redeemedCodes);
        setStartedAt(new Date(data.startedAt));
      } catch {
        if (!cancelled) setError("Network error loading game state");
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, teamId, reloadKey]);

  async function handleRetry() {
    if (
      !confirm(
        "Start a fresh board? The minefield and passages reshuffle; hearts and verse score reset. Amazing Race codes you already redeemed stay unlocked — power-ups refresh for this run.",
      )
    ) {
      return;
    }
    setRetrying(true);
    setVerseMsg("");
    setLastSolvedText(null);
    try {
      const res = await fetch("/api/unmasked/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, teamId, reset: true, slug: "unmasked" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setVerseMsg(String(data.error ?? "Could not start a new board"));
        setRetrying(false);
        return;
      }
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

  const doAction = useCallback(
    async (
      action: string,
      index?: number,
      powerUpType?: PowerUpType,
      extra?: { axis?: "row" | "col" },
    ) => {
      const res = await fetch("/api/unmasked/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, teamId, action, index, powerUpType, gameSlug, ...extra }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const s = data.state;
      setRevealed(new Set(s.revealed));
      setFlagged(new Set(s.flagged));
      setHearts(s.hearts);
      setMaxHearts(s.maxHearts);
      setLiesHit(s.liesHit);
      setShielded(s.shielded);
      setPowerUps(s.powerUps);
      setStatus(s.status);
      if (Array.isArray(s.versesRestored)) setVersesRestored(s.versesRestored);
      if (typeof s.verseScore === "number") setVerseScore(s.verseScore);
      if (Array.isArray(s.verseAssemblyIndices)) {
        setVerseAssemblyIndices(s.verseAssemblyIndices);
      }
      return data.result;
    },
    [sessionId, teamId, gameSlug],
  );

  const doCheckVerse = useCallback(async () => {
    setVerseMsg("");
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
      setVerseScore(s.verseScore ?? 0);
      setVerseAssemblyIndices(s.verseAssemblyIndices ?? []);
    }
    const r = data.result;
    if (r?.ok) {
      const entry = getVerseByKey(r.verseKey);
      setLastSolvedText(entry?.full ?? null);
      setVerseMsg(`+${r.pointsAdded} pts — passage restored!`);
      setTimeout(() => setVerseMsg(""), 4000);
      setTimeout(() => setLastSolvedText(null), 12000);
    } else if (r?.reason) {
      setVerseMsg(r.reason);
    }
  }, [sessionId, teamId, verseAssemblyIndices]);

  function resetPowerUpIntent() {
    setActivePowerUp(null);
    setPendingAxisTile(null);
  }

  function showPowerUpMessage(message: string, duration = 3500) {
    setCodeMsg(message);
    setTimeout(() => setCodeMsg(""), duration);
  }

  async function handleTileClick(index: number) {
    if (status !== "playing" || !board) return;

    if (activePowerUp === "truth_radar") {
      setPendingAxisTile(index);
      showPowerUpMessage("Truth Radar locked on. Choose Row or Column.");
      return;
    }

    if (activePowerUp === "verse_compass") {
      const result = await doAction("use_powerup", index, "verse_compass");
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
      const result = await doAction("use_powerup", index, "lie_pin");
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
      const result = await doAction("use_powerup", index, "gentle_step");
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
      const result = await doAction("use_powerup", index, "scout");
      resetPowerUpIntent();
      if (!result) return;
      if (!result.success) {
        showPowerUpMessage(result.reason ?? "Scout fizzled.", 4000);
        return;
      }
      if (result.peekedIndex != null) {
        setScoutPeek({
          index: result.peekedIndex,
          kind: String(result.peekedKind ?? "truth"),
        });
        setShimmerTile(result.peekedIndex);
        setTimeout(() => setShimmerTile(null), 1300);
        setTimeout(() => setScoutPeek(null), 3000);
      }
      return;
    }

    if (revealed.has(index)) return;

    if (flagMode) {
      await doAction("flag", index);
      return;
    }

    const result = await doAction("reveal", index);
    if (!result) return;

    if (result.type === "lie") {
      setLiePopup({ text: result.text, shieldUsed: result.shieldUsed });
      setTimeout(() => setLiePopup(null), 4000);
      flashTiles([index], "truth_radar", 1800);
      return;
    }

    if (Array.isArray(result.floodRevealed) && result.floodRevealed.length > 0) {
      flashTiles(result.floodRevealed, "reveal", 1600);
    }
  }

  function handleLongPressStart(index: number) {
    if (ARMABLE_POWER_UPS.has(activePowerUp ?? "extra_heart")) return;
    longPressTimer.current = setTimeout(() => {
      if (status === "playing" && !revealed.has(index)) {
        void doAction("flag", index);
      }
    }, 500);
  }

  function handleLongPressEnd() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function handleContextMenu(e: React.MouseEvent, index: number) {
    e.preventDefault();
    if (ARMABLE_POWER_UPS.has(activePowerUp ?? "extra_heart")) return;
    if (status === "playing" && !revealed.has(index)) {
      void doAction("flag", index);
    }
  }

  async function handleRedeem() {
    if (!codeInput.trim()) return;
    setCodeMsg("");
    const res = await fetch("/api/unmasked/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, teamId, code: codeInput.trim() }),
    });
    const data = await res.json();
    if (!res.ok) {
      setCodeMsg(data.error ?? "Failed");
      return;
    }
    const label = POWER_UP_LABELS[data.powerUpType as PowerUpType]?.label ?? data.powerUpType;
    setCodeMsg(
      data.repaired ?
        `Recovered unlock: ${label} — your code was saved earlier; the reward is now applied.`
      : `Unlocked: ${label}`,
    );
    setRedeemedCodes((prev) => [...prev, codeInput.trim().toUpperCase()]);
    setPowerUps((prev) => [...prev, { type: data.powerUpType, used: false }]);
    setCodeInput("");
    setTimeout(() => setCodeMsg(""), 3000);
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
    const result = await doAction("use_powerup", undefined, type);
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
    const result = await doAction("use_powerup", pendingAxisTile, "truth_radar", { axis });
    const origin = pendingAxisTile;
    resetPowerUpIntent();
    if (!result) return;
    if (result.success === false) {
      showPowerUpMessage(result.reason ?? "Truth Radar fizzled.", 4200);
      return;
    }
    if (typeof result.revealedIndex === "number") {
      flashTiles([origin, result.revealedIndex], "truth_radar", 2200);
      setLiePopup({
        text: String(result.lieText ?? "A lie about your identity"),
        shieldUsed: false,
      });
      setTimeout(() => setLiePopup(null), 4000);
      showPowerUpMessage(
        `Truth Radar exposed a lie on that ${axis}.`,
        3000,
      );
    }
  }

  const solvedSet = useMemo(() => new Set(versesRestored), [versesRestored]);

  const indicesSolvedAway = useMemo(() => {
    const s = new Set<number>();
    for (const f of verseFragments) {
      if (solvedSet.has(f.verseKey)) s.add(f.index);
    }
    return s;
  }, [verseFragments, solvedSet]);

  /** Revealed fragments still in play (not yet restored as a complete verse). */
  const availablePool = useMemo(() => {
    return verseFragments.filter(
      (f) => revealed.has(f.index) && !indicesSolvedAway.has(f.index),
    );
  }, [verseFragments, revealed, indicesSolvedAway]);

  const bankIndices = useMemo(() => {
    const inAssembly = new Set(verseAssemblyIndices);
    return availablePool.filter((f) => !inAssembly.has(f.index)).map((f) => f.index);
  }, [availablePool, verseAssemblyIndices]);

  const assemblyFragments = useMemo(() => {
    return verseAssemblyIndices
      .map((i) => verseFragments.find((f) => f.index === i))
      .filter(Boolean) as VerseFragRow[];
  }, [verseAssemblyIndices, verseFragments]);

  function addToAssembly(tileIndex: number) {
    if (status !== "playing") return;
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

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
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
  const versesLeft = verseKeys.filter((k) => !solvedSet.has(k)).length;
  const cellRem = board ? Math.min(2.85, 58 / board.gridSize) : 2.85;

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
        <span className="font-mono text-muted-foreground">
          {formatTime(elapsed)}
        </span>
        <span className="text-muted-foreground">{tilesRemaining} tiles left</span>
        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-100">
          Verse score: {verseScore}
        </span>
        <span className="text-xs text-muted-foreground">
          Passages to restore: {versesLeft}/{verseKeys.length}
        </span>
        {status === "won" ? (
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
            Board clear!
          </span>
        ) : status === "lost" ? (
          <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800 dark:bg-red-950 dark:text-red-200">
            Game Over
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => void handleRetry()}
          disabled={retrying}
          className="ui-button-secondary inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-foreground shadow-sm disabled:opacity-50 sm:ml-auto"
        >
          <RotateCcw className={`size-3.5 ${retrying ? "animate-spin" : ""}`} />
          {retrying ? "Shuffling…" : "New board"}
        </button>
      </div>

      {status === "playing" ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setFlagMode(!flagMode);
              resetPowerUpIntent();
            }}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
              flagMode
                ? "border-amber-400 bg-amber-50 text-amber-800 dark:border-amber-600 dark:bg-amber-950 dark:text-amber-200"
                : "border-border text-muted-foreground hover:bg-muted"
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
          {activePowerUp === "truth_radar" && pendingAxisTile != null ? (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => void handleTruthRadarAxis("row")}
                className="rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/15"
              >
                Row
              </button>
              <button
                type="button"
                onClick={() => void handleTruthRadarAxis("col")}
                className="rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/15"
              >
                Column
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {liePopup ? (
        <div className="animate-in fade-in rounded-xl border border-red-300 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-950">
          <p className="text-sm font-medium text-red-900 dark:text-red-100">
            {liePopup.shieldUsed ? "Shield blocked: " : "Lie revealed: "}
            &ldquo;{liePopup.text}&rdquo;
          </p>
          <p className="mt-1 text-xs text-red-700 dark:text-red-300">
            {liePopup.shieldUsed
              ? "Your shield protected you — no heart lost!"
              : "That's a lie about your identity. God says otherwise."}
          </p>
        </div>
      ) : null}

      {scoutPeek ? (
        <div className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">
          Tile peeked: {scoutPeek.kind === "lie" ? "Danger (Lie)" : "Safe (Truth)"} — fading in 3s...
        </div>
      ) : null}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:gap-4">
        <aside className="order-2 w-full max-w-full lg:order-1 lg:w-36 lg:max-w-[9.5rem] lg:shrink-0">
          <div className="ui-card-muted rounded-xl p-2 sm:p-2.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-foreground">Power-ups</p>
              <span className="text-[11px] text-muted-foreground">Hover for help</span>
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
                  isReady ? POWER_UP_HINTS[type]
                  : isUsedUp ? "All charges used for this power-up on this board."
                  : `${POWER_UP_HINTS[type]} Redeem a code to unlock.`;
                return (
                  <div key={type} className="group relative min-w-0">
                    <div title={title}>
                      <button
                        type="button"
                        onClick={() => isReady && void handleUsePowerUp(type)}
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
                  </div>
                );
              })}
            </div>
          </div>
        </aside>

        <div className="order-1 min-w-0 flex-1 lg:order-2">
          <div
            className="mx-auto grid w-full gap-0.5 sm:gap-1"
            style={{
              gridTemplateColumns: `repeat(${board.gridSize}, minmax(0, 1fr))`,
              maxWidth: `min(99vw, ${board.gridSize * cellRem}rem)`,
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
          const focalRevealPick =
            "border border-primary/40 ring-1 ring-primary/30 hover:bg-primary/5";

          if (isRevealed) {
            if (isLie) {
              const cls = `flex aspect-square min-h-0 items-center justify-center rounded text-[0.65rem] sm:text-xs ${
                isHighlighted && highlightMode === "truth_radar" ?
                  "animate-pulse border border-red-400 bg-red-200 dark:border-red-500 dark:bg-red-900"
                : "bg-red-100 dark:bg-red-950"
              } ${needsFocalTileFromGrid ? focalRevealPick : ""}`;
              return needsFocalTileFromGrid ? (
                <button
                  key={i}
                  type="button"
                  disabled={status !== "playing"}
                  onClick={() => void handleTileClick(i)}
                  className={cls}
                  title={tile.lieText}
                >
                  <span className={`${isHighlighted ? "animate-bounce" : ""} text-red-600 dark:text-red-400`}>X</span>
                </button>
              ) : (
                <div key={i} className={cls} title={tile.lieText}>
                  <span className={`${isHighlighted ? "animate-bounce" : ""} text-red-600 dark:text-red-400`}>X</span>
                </div>
              );
            }
            if (isVerse) {
              const cls = `verse-magic-tile relative flex aspect-square min-h-0 items-center justify-center overflow-hidden rounded-lg border-2 border-amber-200/75 dark:border-violet-400/55 ${
                isHighlighted && highlightMode === "verse_compass" ?
                  "ring-2 ring-violet-400 ring-offset-1 ring-offset-background dark:ring-violet-300 dark:ring-offset-background"
                : ""
              } ${needsFocalTileFromGrid ? focalRevealPick : ""}`;
              const verseClue =
                tile.adjacentLies > 0 ? (
                  <span
                    className={`relative z-10 text-[0.75rem] font-bold tabular-nums drop-shadow-[0_1px_1px_rgba(255,255,255,0.85)] dark:drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)] sm:text-sm ${numberColor(tile.adjacentLies)}`}
                  >
                    {tile.adjacentLies}
                  </span>
                ) : (
                  <Sparkles
                    className="relative z-10 size-4 text-amber-50 opacity-95 drop-shadow-[0_0_8px_rgba(250,232,255,0.95)] dark:text-cyan-100 dark:opacity-90 sm:size-[1.15rem]"
                    strokeWidth={2}
                  />
                );
              return needsFocalTileFromGrid ? (
                <button
                  key={i}
                  type="button"
                  disabled={status !== "playing"}
                  onClick={() => void handleTileClick(i)}
                  className={cls}
                  title="Passage tile — number shows adjacent lies"
                >
                  <Sparkles
                    className="pointer-events-none absolute right-0.5 top-0.5 z-0 size-2.5 opacity-55 text-white dark:opacity-40"
                    aria-hidden
                  />
                  {verseClue}
                </button>
              ) : (
                <div key={i} className={cls} title="Passage tile — number shows adjacent lies">
                  <Sparkles
                    className="pointer-events-none absolute right-0.5 top-0.5 z-0 size-2.5 opacity-55 text-white dark:opacity-40"
                    aria-hidden
                  />
                  {verseClue}
                </div>
              );
            }
            const cls = `flex aspect-square min-h-0 items-center justify-center rounded ${
              isHighlighted && (highlightMode === "reveal" || highlightMode === "safe_opening" || highlightMode === "gentle_step") ?
                "animate-pulse border border-emerald-400 bg-emerald-100 dark:border-emerald-600 dark:bg-emerald-950"
              : "bg-zinc-100 dark:bg-zinc-800"
            } ${needsFocalTileFromGrid ? focalRevealPick : ""}`;
            return needsFocalTileFromGrid ? (
              <button
                key={i}
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
              <div key={i} className={cls}>
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
              type="button"
              onClick={() => void handleTileClick(i)}
              onContextMenu={(e) => handleContextMenu(e, i)}
              onMouseDown={() => handleLongPressStart(i)}
              onMouseUp={handleLongPressEnd}
              onMouseLeave={handleLongPressEnd}
              onTouchStart={() => handleLongPressStart(i)}
              onTouchEnd={handleLongPressEnd}
              disabled={status !== "playing"}
              className={`flex aspect-square min-h-0 items-center justify-center rounded border text-[0.65rem] font-medium transition sm:text-xs ${
                isScoutPeek
                  ? scoutPeek.kind === "lie"
                    ? "border-red-400 bg-red-100 dark:border-red-600 dark:bg-red-950"
                    : "border-emerald-400 bg-emerald-100 dark:border-emerald-600 dark:bg-emerald-950"
                  : isHighlighted && highlightMode === "lie_pin"
                    ? "animate-pulse border-rose-500 bg-rose-100 dark:border-rose-500 dark:bg-rose-950/90"
                  : isTruthRadarOrigin
                    ? "border-primary bg-primary/10 ring-2 ring-primary/40"
                  : (activePowerUp === "scout" ||
                      activePowerUp === "verse_compass" ||
                      activePowerUp === "truth_radar" ||
                      activePowerUp === "lie_pin" ||
                      activePowerUp === "gentle_step") &&
                      !isFlagged
                    ? "border-primary/50 ring-1 ring-primary/30 hover:bg-primary/5"
                    : isShimmer
                      ? "animate-pulse border-primary/50 bg-primary/10"
                    : isFlagged
                      ? "border-rose-400/80 bg-rose-100 dark:border-rose-600 dark:bg-rose-950/90"
                      : "border-border bg-muted hover:bg-muted/80"
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {isFlagged ? (
                <Flag className="size-2.5 text-rose-600 dark:text-rose-400 sm:size-3.5" />
              ) : isScoutPeek ? (
                <Eye className="size-2.5 sm:size-3.5" />
              ) : null}
            </button>
          );
            })}
          </div>
        </div>
      </div>

      {status === "lost" ? (
        <p className="text-center text-sm text-muted-foreground">
          All hearts lost. The board above shows what was hidden. Don&apos;t let the lies define you. Use{" "}
          <strong>New board</strong> below for a new shuffle and fresh hearts — codes you already redeemed stay
          unlocked and your power-ups refresh.
        </p>
      ) : status === "won" ? (
        <p className="text-center text-sm text-emerald-700 dark:text-emerald-300">
          All truths revealed in {formatTime(elapsed)}! {hearts}/{maxHearts} hearts remaining, {liesHit}{" "}
          lies hit. Verse score: {verseScore}. <strong>New board</strong> reshuffles the field; redeemed codes stay
          saved and power-ups refresh.
        </p>
      ) : null}

      {status === "playing" ? (
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
          {codeMsg ? (
            <p
              className={`mt-2 text-xs ${codeMsg.startsWith("Unlocked") ? "text-emerald-600" : "text-accent"}`}
            >
              {codeMsg}
            </p>
          ) : null}
          {redeemedCodes.length > 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Redeemed: {redeemedCodes.join(", ")}
            </p>
          ) : null}
        </div>
      ) : null}

      {availablePool.length > 0 || assemblyFragments.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-900 dark:bg-amber-950/40">
          <p className="text-xs font-semibold text-amber-900 dark:text-amber-100">
            Passage fragments (no references — use meaning & memory)
          </p>
          <p className="mt-1 text-xs text-amber-800/90 dark:text-amber-200/90">
            Tap the stack to move phrases into the builder row. Arrange one full passage in order, then{" "}
            <strong>Check passage</strong> for score. Correct lines leave your stack.
          </p>
          {verseMsg ? (
            <p className="mt-2 text-sm text-amber-900 dark:text-amber-100">{verseMsg}</p>
          ) : null}
          {lastSolvedText ? (
            <p className="mt-2 rounded-lg border border-amber-300/80 bg-white/80 px-3 py-2 text-sm font-medium text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-50">
              &ldquo;{lastSolvedText}&rdquo;
            </p>
          ) : null}

          <p className="mt-3 text-[0.7rem] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
            Stack
          </p>
          <div className="mt-1 flex min-h-[2.5rem] flex-wrap gap-1.5">
            {bankIndices.length === 0 && assemblyFragments.length === 0 ? (
              <span className="text-xs text-amber-700 dark:text-amber-400">
                Reveal enchanted passage tiles on the board to collect lines.
              </span>
            ) : null}
            {bankIndices.map((idx) => {
              const frag = verseFragments.find((f) => f.index === idx);
              if (!frag) return null;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => addToAssembly(idx)}
                  disabled={status !== "playing"}
                  className="rounded-lg border border-amber-400 bg-white px-2 py-1 text-left text-[0.7rem] font-medium text-amber-950 shadow-sm transition hover:bg-amber-100 disabled:opacity-50 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-50 dark:hover:bg-amber-900"
                >
                  {frag.text}
                </button>
              );
            })}
          </div>

          <p className="mt-4 text-[0.7rem] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
            Builder row
          </p>
          <div className="mt-1 flex min-h-[2.5rem] flex-wrap items-start gap-1">
            {assemblyFragments.length === 0 ? (
              <span className="text-xs text-amber-700 dark:text-amber-400">
                Add phrases from the stack in the order you think is right.
              </span>
            ) : null}
            {assemblyFragments.map((frag, i) => (
              <div key={`${frag.index}-${i}`} className="flex items-center gap-0.5">
                {i > 0 ? (
                  <button
                    type="button"
                    onClick={() => moveWithinAssembly(i, i - 1)}
                    className="px-0.5 text-[0.65rem] text-amber-700 hover:text-amber-950 dark:text-amber-300"
                    title="Move left"
                  >
                    &larr;
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => removeFromAssembly(i)}
                  className="rounded-lg border border-amber-500 bg-amber-100 px-2 py-1 text-left text-[0.7rem] font-medium text-amber-950 dark:border-amber-600 dark:bg-amber-900 dark:text-amber-50"
                  title="Back to stack"
                >
                  {frag.text}
                </button>
                {i < assemblyFragments.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => moveWithinAssembly(i, i + 1)}
                    className="px-0.5 text-[0.65rem] text-amber-700 hover:text-amber-950 dark:text-amber-300"
                    title="Move right"
                  >
                    &rarr;
                  </button>
                ) : null}
              </div>
            ))}
          </div>

          {status === "playing" && assemblyFragments.length > 0 ? (
            <button
              type="button"
              onClick={() => void doCheckVerse()}
              className="mt-3 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500"
            >
              Check passage
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="ui-card-muted rounded-xl p-4 text-xs leading-relaxed text-foreground">
        <p className="font-semibold text-foreground">How to Play</p>
        <ul className="mt-2 list-inside list-disc space-y-1.5">
          <li>Tap a tile to reveal it. Numbers show adjacent lies.</li>
          <li>
            Use <strong>Flag mode</strong> or <strong>long-press / right-click</strong> to flag suspected lies.
          </li>
          <li>Hitting a lie costs 1 heart. Lose all hearts = game over.</li>
          <li>
            <strong>Enchanted passage tiles</strong> hide Scripture fragments — no book/chapter
            hints.
          </li>
          <li>
            Stack fragments below, move them into the builder row, reorder by sense, then <strong>Check passage</strong>{" "}
            to score and clear that passage from your stack.
          </li>
          <li>
            Enter <strong>power-up codes</strong> earned from physical challenges for special abilities.
          </li>
          <li>
            <strong>Safe opening</strong> (if your camp uses it) automatically reveals the biggest “clear patch” —
            like a perfect Minesweeper first click.
          </li>
          <li>
            <strong>New board</strong> reshuffles the minefield and clears hearts and verse score for a new run. Codes
            you already redeemed stay unlocked — you don&apos;t re-enter them, and your power-ups refresh.
          </li>
        </ul>
      </div>
    </div>
  );
}
