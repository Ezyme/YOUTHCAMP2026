export type MindgameGoal = "sort_desc" | "odd_even" | "sort_asc";

/** Standard = 10×3 / 10 pins; Quick = 8×3 / 8 pins. */
export type BoardVariant = "standard" | "quick";

/** Lattice vertex: row r, column c on an intersections grid (not cell centers). */
export type Cell = { r: number; c: number };

/** Pairs of adjacent diagonal-eligible vertices (for drawing connector lines in the UI). */
export type DiagonalEdgePair = readonly [Cell, Cell];

/**
 * 10×3 maze with 3 choke rows (r0, r4, r8) where both wing cells are walled,
 * alternating half-blocks in between, and 2 diagonal bridges across chokes.
 */
const BLOCKED_COORDS_10: readonly [number, number][] = [
  [0, 0],
  [0, 2], // r0 CHOKE
  [1, 2], // r1 right-blocked → left wing
  [2, 0], // r2 left-blocked → right wing
  [3, 2], // r3 right-blocked → left wing (diag)
  [4, 0],
  [4, 2], // r4 CHOKE (diag on spine)
  [5, 0], // r5 left-blocked → right wing (diag)
  [6, 2], // r6 right-blocked → left wing
  [7, 0], // r7 left-blocked → right wing (diag)
  [8, 0],
  [8, 2], // r8 CHOKE (diag on spine)
];

/**
 * Diagonal bridges cross choke rows wing→spine→opposite-wing.
 * Bridge A: (3,0)↔(4,1)↔(5,2) — crosses r4 choke, LEFT zone1 → RIGHT zone2.
 * Bridge B: (7,2)↔(8,1)↔(9,0) — crosses r8 choke, RIGHT zone2 → LEFT zone3.
 */
const DIAGONAL_COORDS_10: readonly [number, number][] = [
  [3, 0],
  [4, 1],
  [5, 2],
  [7, 2],
  [8, 1],
  [9, 0],
];

/** Adjacent diagonal-node pairs for UI connector lines (10-pin board). */
const DIAGONAL_EDGES_10: readonly DiagonalEdgePair[] = [
  [{ r: 3, c: 0 }, { r: 4, c: 1 }],
  [{ r: 4, c: 1 }, { r: 5, c: 2 }],
  [{ r: 7, c: 2 }, { r: 8, c: 1 }],
  [{ r: 8, c: 1 }, { r: 9, c: 0 }],
];

/**
 * 8×3 maze: two choke rows (r2, r5), alternating wing access, two X-crossing bridges.
 */
const BLOCKED_COORDS_8: readonly [number, number][] = [
  [0, 0],
  [1, 2],
  [2, 0],
  [2, 2], // r2 CHOKE
  [4, 0],
  [5, 0],
  [5, 2], // r5 CHOKE
  [6, 2],
];

/**
 * Bridge A: (1,0)↔(2,1)↔(3,2) — crosses r2 choke, left → right.
 * Bridge B: (4,2)↔(5,1)↔(6,0) — crosses r5 choke, right → left.
 */
const DIAGONAL_COORDS_8: readonly [number, number][] = [
  [1, 0],
  [2, 1],
  [3, 2],
  [4, 2],
  [5, 1],
  [6, 0],
];

const DIAGONAL_EDGES_8: readonly DiagonalEdgePair[] = [
  [{ r: 1, c: 0 }, { r: 2, c: 1 }],
  [{ r: 2, c: 1 }, { r: 3, c: 2 }],
  [{ r: 4, c: 2 }, { r: 5, c: 1 }],
  [{ r: 5, c: 1 }, { r: 6, c: 0 }],
];

function cellKey(r: number, c: number): string {
  return `${r},${c}`;
}

function makeFixedBoard(
  rows: number,
  cols: number,
  playerCount: number,
  blockedCoords: readonly [number, number][],
  diagonalCoords: readonly [number, number][],
) {
  return {
    rows,
    cols,
    playerCount,
    blocked: new Set(blockedCoords.map(([r, c]) => cellKey(r, c))),
    diagonalNodes: new Set(diagonalCoords.map(([r, c]) => cellKey(r, c))),
  } as const;
}

/** 10×3 lattice, 10 pins, 12 walls, 6 diagonal-eligible crossings. */
export const FIXED_BOARD_10 = makeFixedBoard(10, 3, 10, BLOCKED_COORDS_10, DIAGONAL_COORDS_10);

/** 8×3 lattice, 8 pins, 8 walls, 6 diagonal-eligible crossings. */
export const FIXED_BOARD_8 = makeFixedBoard(8, 3, 8, BLOCKED_COORDS_8, DIAGONAL_COORDS_8);

/** @deprecated Use FIXED_BOARD_10 or getFixedBoard(variant) */
export const FIXED_BOARD = FIXED_BOARD_10;

export function getFixedBoard(variant: BoardVariant = "standard") {
  return variant === "quick" ? FIXED_BOARD_8 : FIXED_BOARD_10;
}

export function getDiagonalEdges(variant: BoardVariant = "standard"): readonly DiagonalEdgePair[] {
  return variant === "quick" ? DIAGONAL_EDGES_8 : DIAGONAL_EDGES_10;
}

export type MindgameState = {
  /** Vertex count vertically (points 0 … rows-1). */
  rows: number;
  /** Vertex count horizontally (points 0 … cols-1). */
  cols: number;
  playerCount: number;
  /** pin index -> vertex */
  positions: Map<number, Cell>;
  goal: MindgameGoal;
  /** Impassable intersections (walls). */
  blocked: Set<string>;
  /** Vertices where diagonal moves may start/end (both endpoints must be in this set). */
  diagonalNodes: Set<string>;
};

export function cloneMindgameState(state: MindgameState): MindgameState {
  return {
    ...state,
    positions: new Map(state.positions),
    blocked: new Set(state.blocked),
    diagonalNodes: new Set(state.diagonalNodes),
  };
}

const ORTH: readonly [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

const DIAG: readonly [number, number][] = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

function diagonalStepAllowed(state: MindgameState, from: Cell, to: Cell): boolean {
  const dr = to.r - from.r;
  const dc = to.c - from.c;
  if (Math.abs(dr) !== 1 || Math.abs(dc) !== 1) return false;
  if (!inBounds(state, to.r, to.c)) return false;
  if (state.blocked.has(cellKey(to.r, to.c))) return false;
  return (
    state.diagonalNodes.has(cellKey(from.r, from.c)) &&
    state.diagonalNodes.has(cellKey(to.r, to.c))
  );
}

export function stepIsAllowed(state: MindgameState, from: Cell, to: Cell): boolean {
  const dr = to.r - from.r;
  const dc = to.c - from.c;
  const ad = Math.abs(dr);
  const bd = Math.abs(dc);
  if (!inBounds(state, to.r, to.c)) return false;
  if (state.blocked.has(cellKey(to.r, to.c))) return false;
  if (ad + bd === 1) return true;
  if (ad === 1 && bd === 1) return diagonalStepAllowed(state, from, to);
  return false;
}

/** Pin index placed at vertical slot `slot` (0 = top of line), goal-specific scramble. */
function creativePinAtVerticalSlot(slot: number, playerCount: number, goal: MindgameGoal): number {
  const P = playerCount;
  if (goal === "sort_desc") {
    let lo = 0;
    let hi = P - 1;
    for (let s = 0; s < slot; s++) {
      if (s % 2 === 0) lo++;
      else hi--;
    }
    return slot % 2 === 0 ? lo : hi;
  }
  if (goal === "sort_asc") {
    let lo = 0;
    let hi = P - 1;
    for (let s = 0; s < slot; s++) {
      if (s % 2 === 0) hi--;
      else lo++;
    }
    return slot % 2 === 0 ? hi : lo;
  }
  const evensFirst: number[] = [];
  const oddsFirst: number[] = [];
  for (let i = 0; i < P; i++) {
    if (i % 2 === 0) evensFirst.push(i);
    else oddsFirst.push(i);
  }
  const antiOddEvenOrder = [...evensFirst, ...oddsFirst];
  return antiOddEvenOrder[slot]!;
}

function fixedInitialPositions(goal: MindgameGoal, variant: BoardVariant): Map<number, Cell> {
  const board = getFixedBoard(variant);
  const playerCount = board.playerCount;
  const centerCol = Math.floor(board.cols / 2);
  const cells: Cell[] = [];
  for (let slot = 0; slot < playerCount; slot++) {
    cells.push({ r: slot, c: centerCol });
  }

  const positions = new Map<number, Cell>();
  for (let slot = 0; slot < playerCount; slot++) {
    const pin = creativePinAtVerticalSlot(slot, playerCount, goal);
    positions.set(pin, cells[slot]!);
  }

  const probe: MindgameState = {
    rows: board.rows,
    cols: board.cols,
    playerCount,
    positions,
    goal,
    blocked: new Set(board.blocked),
    diagonalNodes: new Set(board.diagonalNodes),
  };
  if (isWinning(probe)) {
    if (playerCount >= 2) {
      const a = positions.get(0)!;
      const b = positions.get(1)!;
      positions.set(0, b);
      positions.set(1, a);
    }
  }

  return positions;
}

export function createInitialState(
  goal: MindgameGoal = "sort_desc",
  variant: BoardVariant = "standard",
): MindgameState {
  const board = getFixedBoard(variant);
  return {
    rows: board.rows,
    cols: board.cols,
    playerCount: board.playerCount,
    positions: fixedInitialPositions(goal, variant),
    goal,
    blocked: new Set(board.blocked),
    diagonalNodes: new Set(board.diagonalNodes),
  };
}

function occupiedVertices(state: MindgameState, excludePin?: number): Set<string> {
  const set = new Set<string>(state.blocked);
  for (const [pin, cell] of state.positions) {
    if (pin === excludePin) continue;
    set.add(cellKey(cell.r, cell.c));
  }
  return set;
}

function inBounds(state: MindgameState, r: number, c: number): boolean {
  return r >= 0 && c >= 0 && r < state.rows && c < state.cols;
}

export function neighborsFromVertex(
  state: MindgameState,
  r: number,
  c: number,
  occ: Set<string>,
): Cell[] {
  const out: Cell[] = [];
  const from: Cell = { r, c };
  for (const [dr, dc] of [...ORTH, ...DIAG]) {
    const nr = r + dr;
    const nc = c + dc;
    if (!inBounds(state, nr, nc)) continue;
    const to: Cell = { r: nr, c: nc };
    if (!stepIsAllowed(state, from, to)) continue;
    if (occ.has(cellKey(nr, nc))) continue;
    out.push(to);
  }
  return out;
}

/** BFS shortest path on lattice: orthogonal + diagonal where both ends are diagonal-eligible. */
export function shortestPath(
  state: MindgameState,
  pinIndex: number,
  to: Cell,
): Cell[] | null {
  const start = state.positions.get(pinIndex);
  if (!start) return null;
  const occ = occupiedVertices(state, pinIndex);
  if (occ.has(cellKey(to.r, to.c))) return null;

  const key = (r: number, c: number) => cellKey(r, c);
  const q: Cell[] = [start];
  const prev = new Map<string, string | null>();
  prev.set(key(start.r, start.c), null);

  while (q.length) {
    const cur = q.shift()!;
    if (cur.r === to.r && cur.c === to.c) {
      const path: Cell[] = [];
      let k: string | null = key(cur.r, cur.c);
      while (k) {
        const [r, c] = k.split(",").map(Number);
        path.push({ r, c });
        k = prev.get(k) ?? null;
      }
      path.reverse();
      return path;
    }
    for (const next of neighborsFromVertex(state, cur.r, cur.c, occ)) {
      const nk = key(next.r, next.c);
      if (prev.has(nk)) continue;
      prev.set(nk, key(cur.r, cur.c));
      q.push(next);
    }
  }
  return null;
}

/** One step to an adjacent vertex (orth or allowed diagonal). */
export function stepPin(
  state: MindgameState,
  pinIndex: number,
  nextCell: Cell,
): MindgameState | null {
  const cur = state.positions.get(pinIndex);
  if (!cur) return null;
  if (!stepIsAllowed(state, cur, nextCell)) return null;
  const occ = occupiedVertices(state, pinIndex);
  if (occ.has(cellKey(nextCell.r, nextCell.c))) return null;

  const positions = new Map(state.positions);
  positions.set(pinIndex, { ...nextCell });
  return { ...state, positions };
}

export function applyPath(
  state: MindgameState,
  pinIndex: number,
  path: Cell[],
): MindgameState | null {
  if (path.length < 2) return state;
  let s = state;
  for (let i = 1; i < path.length; i++) {
    const n = stepPin(s, pinIndex, path[i]);
    if (!n) return null;
    s = n;
  }
  return s;
}

function cellOrderKey(cell: Cell): number {
  return cell.r * 10000 + cell.c;
}

export function sortedPinsByReadingOrder(state: MindgameState): number[] {
  const entries = [...state.positions.entries()].sort(
    (a, b) => cellOrderKey(a[1]) - cellOrderKey(b[1]),
  );
  return entries.map(([pin]) => pin);
}

/** Win: every pin on center column, then goal order top-to-bottom. */
export function isWinning(state: MindgameState): boolean {
  const centerCol = Math.floor(state.cols / 2);
  for (const [, cell] of state.positions) {
    if (cell.c !== centerCol) return false;
  }
  const order = sortedPinsByReadingOrder(state);
  if (state.goal === "sort_desc") {
    for (let i = 0; i < order.length - 1; i++) {
      if (order[i]! < order[i + 1]!) return false;
    }
    return true;
  }
  if (state.goal === "sort_asc") {
    for (let i = 0; i < order.length - 1; i++) {
      if (order[i]! > order[i + 1]!) return false;
    }
    return true;
  }
  if (state.goal === "odd_even") {
    const odds = order.filter((p) => p % 2 === 1);
    const evens = order.filter((p) => p % 2 === 0);
    const target = [...odds, ...evens];
    if (target.length !== order.length) return false;
    for (let i = 0; i < order.length; i++) {
      if (order[i] !== target[i]) return false;
    }
    return true;
  }
  return false;
}

export function serializePositions(
  positions: Map<number, Cell>,
): { pinIndex: number; r: number; c: number }[] {
  return [...positions.entries()].map(([pinIndex, cell]) => ({
    pinIndex,
    r: cell.r,
    c: cell.c,
  }));
}

export function deserializePositions(
  arr: { pinIndex: number; r: number; c: number }[],
): Map<number, Cell> {
  const m = new Map<number, Cell>();
  for (const x of arr) {
    m.set(x.pinIndex, { r: x.r, c: x.c });
  }
  return m;
}

function sortCoords(a: { r: number; c: number }, b: { r: number; c: number }): number {
  return a.r - b.r || a.c - b.c;
}

export function serializeBlocked(blocked: Set<string>): { r: number; c: number }[] {
  return [...blocked]
    .map((k) => {
      const [r, c] = k.split(",").map(Number);
      return { r, c };
    })
    .sort(sortCoords);
}

export function deserializeBlocked(arr: { r: number; c: number }[]): Set<string> {
  const s = new Set<string>();
  for (const x of arr) {
    s.add(cellKey(x.r, x.c));
  }
  return s;
}

export function serializeDiagonalNodes(
  diagonalNodes: Set<string>,
): { r: number; c: number }[] {
  return [...diagonalNodes]
    .map((k) => {
      const [r, c] = k.split(",").map(Number);
      return { r, c };
    })
    .sort(sortCoords);
}

export function deserializeDiagonalNodes(arr: { r: number; c: number }[]): Set<string> {
  const s = new Set<string>();
  for (const x of arr) {
    s.add(cellKey(x.r, x.c));
  }
  return s;
}

/** Snapshot of wall + diagonal layout for persistence / stale-save detection. */
export function getFixedBoardPersistSnapshot(variant: BoardVariant = "standard"): {
  blocked: { r: number; c: number }[];
  diagonalNodes: { r: number; c: number }[];
} {
  const board = getFixedBoard(variant);
  return {
    blocked: serializeBlocked(board.blocked),
    diagonalNodes: serializeDiagonalNodes(board.diagonalNodes),
  };
}

export function boardsMatchPersisted(
  blocked: { r: number; c: number }[] | undefined,
  diagonalNodes: { r: number; c: number }[] | undefined,
  variant: BoardVariant = "standard",
): boolean {
  if (!Array.isArray(blocked) || !Array.isArray(diagonalNodes)) return false;
  const snap = getFixedBoardPersistSnapshot(variant);
  const b = [...blocked].sort(sortCoords);
  const d = [...diagonalNodes].sort(sortCoords);
  return (
    JSON.stringify(b) === JSON.stringify(snap.blocked) &&
    JSON.stringify(d) === JSON.stringify(snap.diagonalNodes)
  );
}
