import type { PowerUpType } from "@/lib/db/models";

export type TileKind = "truth" | "lie" | "verse";

/** One fragment placed on the board (may belong to any verse in this game). */
export type VerseFragmentPlacement = {
  text: string;
  /** Order within that verse (0 … n-1). */
  order: number;
  verseKey: string;
};

export type Tile = {
  kind: TileKind;
  adjacentLies: number;
  /** Lie text shown when a lie tile is revealed. */
  lieText?: string;
  /** Verse fragment text for verse tiles. */
  verseText?: string;
  /** Order index within the full verse (for assembly). */
  verseOrder?: number;
  /** Which verse this fragment belongs to (not shown to players in UI). */
  verseKey?: string;
};

export type Board = {
  gridSize: number;
  totalLies: number;
  tiles: Tile[];
  /** Flat indices of lie tiles. */
  lieIndices: number[];
  /** Flat indices of verse fragment tiles. */
  verseIndices: number[];
};

export type GameState = {
  board: Board;
  revealed: Set<number>;
  flagged: Set<number>;
  hearts: number;
  maxHearts: number;
  liesHit: number;
  shielded: boolean;
  powerUps: { type: PowerUpType; used: boolean }[];
  status: "playing" | "won" | "lost";
};

export type RevealResult =
  | { type: "number"; value: number; floodRevealed: number[] }
  | { type: "lie"; text: string; heartsLeft: number; shieldUsed: boolean }
  | { type: "verse"; text: string; order: number; verseKey: string; floodRevealed: number[] }
  | { type: "already_revealed" }
  | { type: "flagged" }
  | { type: "game_over" };

const LIE_TEXTS: readonly string[] = [
  "You are what people think of you",
  "Your past defines your future",
  "You need to earn God's love",
  "You're not good enough",
  "Your worth comes from achievements",
  "Nobody truly cares about you",
  "You have to be perfect to be loved",
  "God is disappointed in you",
  "You are your mistakes",
  "You don't belong anywhere",
  "Your value depends on your appearance",
  "You are too broken to be fixed",
  "You must prove yourself to matter",
  "Happiness comes from popularity",
  "You're only as good as your last success",
  "Your identity is defined by social media",
  "You'll never be forgiven",
  "God could never use someone like you",
  "Real strength means hiding your feelings",
  "You're always going to be alone",
];

/** Mulberry32 seeded PRNG — deterministic from a 32-bit seed. */
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleWithRng<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Fisher–Yates order using a deterministic PRNG (same seed ⇒ same stack order for that board). */
export function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const rng = mulberry32(seed ^ 0xa5a5_a5a5);
  return shuffleWithRng([...items], rng);
}

function getNeighbors(index: number, gridSize: number): number[] {
  const row = Math.floor(index / gridSize);
  const col = index % gridSize;
  const neighbors: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = row + dr;
      const nc = col + dc;
      if (nr >= 0 && nr < gridSize && nc >= 0 && nc < gridSize) {
        neighbors.push(nr * gridSize + nc);
      }
    }
  }
  return neighbors;
}

export function generateBoard(
  seed: number,
  gridSize: number,
  totalLies: number,
  verseFragments: VerseFragmentPlacement[],
): Board {
  const cellCount = gridSize * gridSize;
  const rng = mulberry32(seed);

  const allIndices = Array.from({ length: cellCount }, (_, i) => i);
  const shuffled = shuffleWithRng(allIndices, rng);

  const lieSet = new Set(shuffled.slice(0, totalLies));
  const safeTiles = shuffled.filter((i) => !lieSet.has(i));
  const verseSlotIndices = safeTiles.slice(0, verseFragments.length);
  const verseSet = new Set(verseSlotIndices);

  const shuffledLieTexts = shuffleWithRng([...LIE_TEXTS], rng);

  const tiles: Tile[] = Array.from({ length: cellCount }, (_, i) => {
    const neighbors = getNeighbors(i, gridSize);
    const adjacentLies = neighbors.filter((n) => lieSet.has(n)).length;

    if (lieSet.has(i)) {
      const lieIdx = [...lieSet].indexOf(i);
      return {
        kind: "lie" as const,
        adjacentLies,
        lieText: shuffledLieTexts[lieIdx % shuffledLieTexts.length],
      };
    }

    if (verseSet.has(i)) {
      const vIdx = verseSlotIndices.indexOf(i);
      const frag = verseFragments[vIdx];
      return {
        kind: "verse" as const,
        adjacentLies,
        verseText: frag.text,
        verseOrder: frag.order,
        verseKey: frag.verseKey,
      };
    }

    return { kind: "truth" as const, adjacentLies };
  });

  return {
    gridSize,
    totalLies,
    tiles,
    lieIndices: [...lieSet],
    verseIndices: verseSlotIndices,
  };
}

/** Flood-reveal all connected zero-adjacency tiles (Minesweeper cascade). */
export function floodReveal(board: Board, startIndex: number, revealed: Set<number>): number[] {
  const newlyRevealed: number[] = [];
  const queue = [startIndex];

  while (queue.length > 0) {
    const idx = queue.shift()!;
    if (revealed.has(idx)) continue;

    const tile = board.tiles[idx];
    if (tile.kind === "lie") continue;

    revealed.add(idx);
    newlyRevealed.push(idx);

    if (tile.adjacentLies === 0) {
      for (const n of getNeighbors(idx, board.gridSize)) {
        if (!revealed.has(n) && board.tiles[n].kind !== "lie") {
          queue.push(n);
        }
      }
    }
  }

  return newlyRevealed;
}

export function revealTile(state: GameState, index: number): RevealResult {
  if (state.status !== "playing") return { type: "game_over" };
  if (state.revealed.has(index)) return { type: "already_revealed" };
  if (state.flagged.has(index)) return { type: "flagged" };

  const tile = state.board.tiles[index];

  if (tile.kind === "lie") {
    state.revealed.add(index);
    state.liesHit++;

    if (state.shielded) {
      state.shielded = false;
      return {
        type: "lie",
        text: tile.lieText ?? "A lie about your identity",
        heartsLeft: state.hearts,
        shieldUsed: true,
      };
    }

    state.hearts--;
    if (state.hearts <= 0) {
      state.hearts = 0;
      state.status = "lost";
    }
    return {
      type: "lie",
      text: tile.lieText ?? "A lie about your identity",
      heartsLeft: state.hearts,
      shieldUsed: false,
    };
  }

  const flooded = floodReveal(state.board, index, state.revealed);

  if (checkWin(state)) {
    state.status = "won";
  }

  if (tile.kind === "verse") {
    return {
      type: "verse",
      text: tile.verseText ?? "",
      order: tile.verseOrder ?? 0,
      verseKey: tile.verseKey ?? "",
      floodRevealed: flooded,
    };
  }

  return {
    type: "number",
    value: tile.adjacentLies,
    floodRevealed: flooded,
  };
}

function clearFlags(state: GameState, indices: number[]) {
  for (const index of indices) {
    state.flagged.delete(index);
  }
}

function revealSingleSafeTile(state: GameState, index: number): RevealResult {
  if (state.status !== "playing") return { type: "game_over" };
  if (state.revealed.has(index)) return { type: "already_revealed" };
  const tile = state.board.tiles[index];
  if (!tile || tile.kind === "lie") return { type: "game_over" };

  clearFlags(state, [index]);
  state.revealed.add(index);

  if (checkWin(state)) {
    state.status = "won";
  }

  if (tile.kind === "verse") {
    return {
      type: "verse",
      text: tile.verseText ?? "",
      order: tile.verseOrder ?? 0,
      verseKey: tile.verseKey ?? "",
      floodRevealed: [index],
    };
  }

  return {
    type: "number",
    value: tile.adjacentLies,
    floodRevealed: [index],
  };
}

export function toggleFlag(state: GameState, index: number): boolean {
  if (state.status !== "playing") return false;
  if (state.revealed.has(index)) return false;

  if (state.flagged.has(index)) {
    state.flagged.delete(index);
  } else {
    state.flagged.add(index);
  }
  return true;
}

export function checkWin(state: GameState): boolean {
  const total = state.board.gridSize * state.board.gridSize;
  for (let i = 0; i < total; i++) {
    const tile = state.board.tiles[i];
    if (tile.kind !== "lie" && !state.revealed.has(i)) {
      return false;
    }
  }
  return true;
}

/**
 * Development / admin tooling: reveal every non-lie tile (full “clear” of the minefield).
 * Does not flip lie tiles. If the run was still in progress and the board is complete, sets `won`.
 */
export function devRevealAllSafeTiles(state: GameState): void {
  const total = state.board.gridSize * state.board.gridSize;
  for (let i = 0; i < total; i++) {
    const tile = state.board.tiles[i];
    if (!tile || tile.kind === "lie") continue;
    state.revealed.add(i);
    state.flagged.delete(i);
  }
  if (state.status === "playing" && checkWin(state)) {
    state.status = "won";
  }
}

/** How many new tiles would open if `startIndex` were revealed (flood from zeros). */
export function countOpeningCascade(
  board: Board,
  startIndex: number,
  revealed: Set<number>,
): number {
  if (board.tiles[startIndex]?.kind === "lie") return -1;
  const trial = new Set(revealed);
  const newly = floodReveal(board, startIndex, trial);
  return newly.length;
}

/**
 * Best unrevealed safe cell to “click” for the largest cascade (ties broken by RNG).
 */
export function findBestSafeOpening(
  board: Board,
  revealed: Set<number>,
  rngSeed: number,
): { index: number; openedCount: number } {
  const total = board.gridSize * board.gridSize;
  const candidates: { index: number; count: number }[] = [];
  for (let i = 0; i < total; i++) {
    if (revealed.has(i)) continue;
    if (board.tiles[i].kind === "lie") continue;
    const count = countOpeningCascade(board, i, revealed);
    if (count > 0) candidates.push({ index: i, count });
  }
  if (candidates.length === 0) return { index: -1, openedCount: 0 };
  const max = Math.max(...candidates.map((c) => c.count));
  const top = candidates.filter((c) => c.count === max);
  const rng = mulberry32(rngSeed);
  const pick = top[Math.floor(rng() * top.length)]!;
  return { index: pick.index, openedCount: pick.count };
}

function getLineIndices(gridSize: number, index: number, axis: "row" | "col"): number[] {
  const row = Math.floor(index / gridSize);
  const col = index % gridSize;

  if (axis === "row") {
    return Array.from({ length: gridSize }, (_, offset) => row * gridSize + offset);
  }

  return Array.from({ length: gridSize }, (_, offset) => offset * gridSize + col);
}

function manhattanDistance(a: number, b: number, gridSize: number): number {
  const ar = Math.floor(a / gridSize);
  const ac = a % gridSize;
  const br = Math.floor(b / gridSize);
  const bc = b % gridSize;
  return Math.abs(ar - br) + Math.abs(ac - bc);
}

/** Nearest candidate to anchor by Manhattan distance; ties break to lower index. */
function pickNearestByManhattan(
  candidates: number[],
  anchor: number,
  gridSize: number,
): number {
  if (candidates.length === 0) return -1;
  const sorted = [...candidates].sort((a, b) => {
    const da = manhattanDistance(a, anchor, gridSize);
    const db = manhattanDistance(b, anchor, gridSize);
    return da - db || a - b;
  });
  return sorted[0]!;
}

export type ApplyPowerUpOptions = {
  /** If &gt; 0, safe_opening only applies when the best cascade opens at least this many tiles (else power-up not used). */
  safeOpeningMinTiles?: number;
  /** Hidden tile to peek (Scout). If omitted, picks a random hidden tile (legacy). */
  scoutTargetIndex?: number;
  truthRadarTargetIndex?: number;
  truthRadarAxis?: "row" | "col";
  verseCompassAnchorIndex?: number;
  liePinAnchorIndex?: number;
  gentleStepAnchorIndex?: number;
};

export function applyPowerUp(
  state: GameState,
  powerUpType: PowerUpType,
  rngSeed?: number,
  options?: ApplyPowerUpOptions,
): {
  success: boolean;
  reason?: string;
  revealedIndex?: number;
  revealedIndices?: number[];
  peekedIndex?: number;
  peekedKind?: TileKind;
  openingSize?: number;
  flaggedIndex?: number;
  lineAxis?: "row" | "col";
  anchorIndex?: number;
  lieText?: string;
} {
  const pu = state.powerUps.find((p) => p.type === powerUpType && !p.used);
  if (!pu) return { success: false, reason: "Power-up not available." };

  const total = state.board.gridSize * state.board.gridSize;
  pu.used = true;

  if (powerUpType === "safe_opening") {
    const minN = Math.max(0, Math.floor(options?.safeOpeningMinTiles ?? 0));
    const best = findBestSafeOpening(state.board, state.revealed, rngSeed ?? Date.now());
    if (best.index < 0) {
      return { success: false, reason: "No safe opening was available." };
    }
    if (minN > 0 && best.openedCount < minN) {
      return {
        success: false,
        reason: "No opening met the minimum clear size.",
      };
    }
    clearFlags(state, [best.index]);
    const reveal = revealTile(state, best.index);
    if ("floodRevealed" in reveal) {
      clearFlags(state, reveal.floodRevealed);
    }
    if (checkWin(state)) state.status = "won";
    return {
      success: true,
      revealedIndex: best.index,
      openingSize: best.openedCount,
    };
  }

  if (powerUpType === "scout") {
    const hidden: number[] = [];
    for (let i = 0; i < total; i++) {
      if (!state.revealed.has(i)) hidden.push(i);
    }
    if (hidden.length === 0) {
      return { success: false, reason: "No hidden tiles left to scout." };
    }

    const t = options?.scoutTargetIndex;
    let pick: number;
    if (t !== undefined && Number.isInteger(t) && t >= 0 && t < total) {
      if (state.revealed.has(t)) {
        return { success: false, reason: "Scout needs a hidden tile." };
      }
      pick = t;
    } else {
      const rng = mulberry32(rngSeed ?? Date.now());
      pick = hidden[Math.floor(rng() * hidden.length)]!;
    }

    return {
      success: true,
      peekedIndex: pick,
      peekedKind: state.board.tiles[pick]!.kind,
    };
  }

  if (powerUpType === "reveal") {
    const unrevealed: number[] = [];
    for (let i = 0; i < total; i++) {
      if (!state.revealed.has(i) && state.board.tiles[i]!.kind !== "lie") {
        unrevealed.push(i);
      }
    }
    if (unrevealed.length === 0) {
      return { success: false, reason: "No hidden safe tiles left." };
    }
    const rng = mulberry32(rngSeed ?? Date.now());
    const pick = unrevealed[Math.floor(rng() * unrevealed.length)]!;
    const flooded = floodReveal(state.board, pick, state.revealed);
    clearFlags(state, flooded);
    if (checkWin(state)) state.status = "won";
    return { success: true, revealedIndex: pick };
  }

  if (powerUpType === "extra_heart") {
    state.maxHearts++;
    state.hearts++;
    return { success: true };
  }

  if (powerUpType === "shield") {
    state.shielded = true;
    return { success: true };
  }

  if (powerUpType === "truth_radar") {
    const targetIndex = options?.truthRadarTargetIndex;
    const axis = options?.truthRadarAxis;
    if (
      targetIndex === undefined ||
      !Number.isInteger(targetIndex) ||
      targetIndex < 0 ||
      targetIndex >= total
    ) {
      return { success: false, reason: "Truth Radar needs a valid target tile." };
    }
    if (axis !== "row" && axis !== "col") {
      return { success: false, reason: "Pick row or column for Truth Radar." };
    }

    const line = getLineIndices(state.board.gridSize, targetIndex, axis);
    const opened: number[] = [];
    for (const idx of line) {
      if (state.revealed.has(idx)) continue;
      const tile = state.board.tiles[idx];
      if (!tile || tile.kind === "lie") continue;
      const reveal = revealSingleSafeTile(state, idx);
      if ("floodRevealed" in reveal) opened.push(idx);
    }

    if (opened.length === 0) {
      return {
        success: false,
        reason: `No hidden truths were found on that ${axis}.`,
        lineAxis: axis,
        anchorIndex: targetIndex,
      };
    }

    if (checkWin(state)) state.status = "won";

    return {
      success: true,
      revealedIndices: opened,
      lineAxis: axis,
      anchorIndex: targetIndex,
    };
  }

  if (powerUpType === "lie_pin") {
    const anchor = options?.liePinAnchorIndex;
    if (
      anchor === undefined ||
      !Number.isInteger(anchor) ||
      anchor < 0 ||
      anchor >= total
    ) {
      return { success: false, reason: "Lie Pin needs a focal tile." };
    }

    const hiddenLies: number[] = [];
    for (let i = 0; i < total; i++) {
      if (!state.revealed.has(i) && state.board.tiles[i]!.kind === "lie") {
        hiddenLies.push(i);
      }
    }
    if (hiddenLies.length === 0) {
      return { success: false, reason: "No hidden lies were left to pin." };
    }
    const pick = pickNearestByManhattan(hiddenLies, anchor, state.board.gridSize);
    if (pick < 0) {
      return { success: false, reason: "No hidden lies were left to pin." };
    }
    state.flagged.add(pick);
    return { success: true, flaggedIndex: pick, anchorIndex: anchor };
  }

  if (powerUpType === "verse_compass") {
    const anchorIndex = options?.verseCompassAnchorIndex;
    if (
      anchorIndex === undefined ||
      !Number.isInteger(anchorIndex) ||
      anchorIndex < 0 ||
      anchorIndex >= total
    ) {
      return { success: false, reason: "Verse Compass needs an anchor tile." };
    }

    const hiddenVerses = state.board.verseIndices
      .filter((index) => !state.revealed.has(index))
      .sort(
        (a, b) =>
          manhattanDistance(a, anchorIndex, state.board.gridSize) -
            manhattanDistance(b, anchorIndex, state.board.gridSize) || a - b,
      );

    if (hiddenVerses.length === 0) {
      return { success: false, reason: "No hidden verse fragments were left." };
    }

    const picks = hiddenVerses.slice(0, 2);
    const actual: number[] = [];
    for (const pick of picks) {
      if (state.revealed.has(pick)) continue;
      clearFlags(state, [pick]);
      const reveal = revealTile(state, pick);
      if ("floodRevealed" in reveal) {
        clearFlags(state, reveal.floodRevealed);
      }
      actual.push(pick);
    }

    return {
      success: actual.length > 0,
      reason: actual.length > 0 ? undefined : "No verse fragments opened.",
      revealedIndices: actual,
      anchorIndex,
    };
  }

  if (powerUpType === "gentle_step") {
    const anchor = options?.gentleStepAnchorIndex;
    if (
      anchor === undefined ||
      !Number.isInteger(anchor) ||
      anchor < 0 ||
      anchor >= total
    ) {
      return { success: false, reason: "Gentle Step needs a focal tile." };
    }

    const hiddenSafe: number[] = [];
    for (let i = 0; i < total; i++) {
      if (!state.revealed.has(i) && state.board.tiles[i]!.kind !== "lie") {
        hiddenSafe.push(i);
      }
    }
    if (hiddenSafe.length === 0) {
      return { success: false, reason: "No safe tiles were left for Gentle Step." };
    }

    const pick = pickNearestByManhattan(hiddenSafe, anchor, state.board.gridSize);
    const reveal = revealSingleSafeTile(state, pick);
    return {
      success: !("type" in reveal && reveal.type === "game_over"),
      revealedIndex: pick,
      revealedIndices: "floodRevealed" in reveal ? reveal.floodRevealed : [pick],
      anchorIndex: anchor,
    };
  }

  return { success: false, reason: "Unknown power-up." };
}

/**
 * Re-order persisted DB fragments to match the sequence `generateBoard` expects
 * (same as verse slot assignment order for this seed/size/lies).
 */
export function sortPersistedFragmentsForBoard(
  seed: number,
  gridSize: number,
  totalLies: number,
  persisted: { index: number; text: string; order: number; verseKey: string }[],
): VerseFragmentPlacement[] {
  if (persisted.length === 0) return [];
  const dummies: VerseFragmentPlacement[] = persisted.map((p) => ({
    text: p.text,
    order: p.order,
    verseKey: p.verseKey,
  }));
  const tempBoard = generateBoard(seed, gridSize, totalLies, dummies);
  const rank = new Map<number, number>();
  tempBoard.verseIndices.forEach((idx, i) => {
    rank.set(idx, i);
  });
  return [...persisted]
    .sort((a, b) => (rank.get(a.index) ?? 0) - (rank.get(b.index) ?? 0))
    .map((p) => ({ text: p.text, order: p.order, verseKey: p.verseKey }));
}

export type VerseSolveResult =
  | { ok: true; verseKey: string; pointsAdded: number }
  | { ok: false; reason: string };

/** Validate builder row: full verse, correct order, not already solved. */
export function trySolveVerseAssembly(
  assemblyIndices: number[],
  allFrags: { index: number; order: number; verseKey: string }[],
  solvedKeys: Set<string>,
): VerseSolveResult {
  if (assemblyIndices.length === 0) {
    return { ok: false, reason: "Add fragments to the builder row first." };
  }
  const byIndex = new Map(allFrags.map((f) => [f.index, f]));
  const metas = assemblyIndices.map((i) => byIndex.get(i));
  if (metas.some((m) => !m)) {
    return { ok: false, reason: "Invalid fragment selection." };
  }
  const key = metas[0]!.verseKey;
  if (metas.some((m) => m!.verseKey !== key)) {
    return { ok: false, reason: "A verse must use only its own fragments." };
  }
  if (solvedKeys.has(key)) {
    return { ok: false, reason: "That passage is already restored." };
  }
  const forKey = allFrags.filter((f) => f.verseKey === key);
  if (assemblyIndices.length !== forKey.length) {
    return { ok: false, reason: "Use every fragment for this passage, or move extras back to the stack." };
  }
  const orders = assemblyIndices.map((i) => byIndex.get(i)!.order);
  const ordered = orders.every((o, idx) => o === idx);
  if (!ordered) {
    return { ok: false, reason: "Order doesn’t match the passage yet." };
  }
  const pointsAdded = forKey.length;
  return { ok: true, verseKey: key, pointsAdded };
}

/** Seconds added to the run timer for each wrong “Check passage” (except redundant checks). */
export const CHECK_PASSAGE_WRONG_PENALTY_SECONDS = 30;

/**
 * When a run is fully complete, each heart still left subtracts this many seconds from the
 * displayed clock (2 minutes per spare heart).
 */
export const REMAINING_HEART_CLOCK_REDUCTION_SECONDS = 120;

export function getDifficultyLies(gridSize: number, difficulty: string): number {
  const total = gridSize * gridSize;
  switch (difficulty) {
    case "easy":
      return Math.floor(total * 0.12);
    case "hard":
      return Math.floor(total * 0.2);
    /** Denser lies — clue numbers 4–5+ appear regularly on medium+ grids. */
    case "expert":
      return Math.floor(total * 0.24);
    case "intense":
      return Math.floor(total * 0.28);
    default:
      return Math.floor(total * 0.16);
  }
}

function maxLieCountForBoard(gridSize: number, verseFragmentCount: number): number {
  const cells = gridSize * gridSize;
  return Math.max(1, cells - verseFragmentCount - 1);
}

/**
 * Lie count from difficulty, optional `settings.totalLies` / `settings.liePercent`, capped so
 * verse tiles + at least one truth cell can exist.
 */
export function resolveUnmaskedLieCount(
  gridSize: number,
  verseFragmentCount: number,
  settings: Record<string, unknown>,
): number {
  const cells = gridSize * gridSize;
  const cap = maxLieCountForBoard(gridSize, verseFragmentCount);

  const explicit = settings.totalLies;
  if (typeof explicit === "number" && Number.isFinite(explicit) && explicit > 0) {
    return Math.min(Math.floor(explicit), cap);
  }

  const pct = settings.liePercent;
  if (typeof pct === "number" && Number.isFinite(pct) && pct > 0 && pct < 0.45) {
    return Math.min(Math.floor(cells * pct), cap);
  }

  const difficulty = String(settings.difficulty ?? "medium");
  return Math.min(getDifficultyLies(gridSize, difficulty), cap);
}

/** Highest adjacent-lie clue on any non-lie tile (truth or verse). */
export function boardMaxAdjacentClue(board: Board): number {
  let m = 0;
  for (const t of board.tiles) {
    if (t.kind !== "lie" && t.adjacentLies > m) m = t.adjacentLies;
  }
  return m;
}
