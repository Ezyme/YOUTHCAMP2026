import type { PowerUpType } from "@/lib/db/models";
import {
  revealTile,
  toggleFlag,
  type Board,
  type GameState,
  type RevealResult,
} from "@/lib/games/unmasked/engine";

/**
 * Slices of the mutable game state the UI needs to set after applying an
 * action locally. Mirrors the shape returned by the server in `data.state`.
 */
export type OptimisticStateSlice = {
  revealed: number[];
  flagged: number[];
  hearts: number;
  maxHearts: number;
  liesHit: number;
  shielded: boolean;
  powerUps: { type: PowerUpType; used: boolean }[];
  status: "playing" | "won" | "lost";
};

export type LocalStateInput = {
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

/**
 * Fresh `GameState` cloned from React slices. Mutating this will not affect
 * the caller's state — the engine functions mutate in place, so cloning here
 * keeps the React state snapshot intact until we `setState`.
 */
export function buildLocalGameState(input: LocalStateInput): GameState {
  return {
    board: input.board,
    revealed: new Set(input.revealed),
    flagged: new Set(input.flagged),
    hearts: input.hearts,
    maxHearts: input.maxHearts,
    liesHit: input.liesHit,
    shielded: input.shielded,
    powerUps: input.powerUps.map((p) => ({ ...p })),
    status: input.status,
  };
}

function toSlice(state: GameState): OptimisticStateSlice {
  return {
    revealed: [...state.revealed],
    flagged: [...state.flagged],
    hearts: state.hearts,
    maxHearts: state.maxHearts,
    liesHit: state.liesHit,
    shielded: state.shielded,
    powerUps: state.powerUps.map((p) => ({ ...p })),
    status: state.status,
  };
}

/**
 * Run `revealTile` against a cloned local state and return both the engine's
 * result (for UI branching — lie popups, flood flash) and the resulting slice.
 */
export function applyRevealLocal(
  input: LocalStateInput,
  index: number,
): { result: RevealResult; next: OptimisticStateSlice } {
  const state = buildLocalGameState(input);
  const result = revealTile(state, index);
  return { result, next: toSlice(state) };
}

/**
 * Run `toggleFlag` against a cloned local state.
 * Returns `changed: false` when the toggle was rejected (game over,
 * already revealed) so the caller can skip state updates and the server POST.
 */
export function applyFlagLocal(
  input: LocalStateInput,
  index: number,
): { changed: boolean; next: OptimisticStateSlice; flaggedNow: boolean } {
  const state = buildLocalGameState(input);
  const changed = toggleFlag(state, index);
  return {
    changed,
    next: toSlice(state),
    flaggedNow: state.flagged.has(index),
  };
}
