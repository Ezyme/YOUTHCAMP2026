import type { PowerUpType } from "@/lib/db/models";

/**
 * Client-side mirror of the mutable Unmasked state, keyed by session+team.
 * Lets the board repaint from the last optimistic snapshot in one frame on
 * reload, before the `GET /api/unmasked/state` response comes back.
 *
 * Only mutable slices live here. The board itself (seed/gridSize/totalLies/
 * verseFragments) is re-derived from the server's authoritative fetch, so
 * the mirror can never resurrect a stale board layout.
 */
export type MirrorSlice = {
  revealed: number[];
  flagged: number[];
  hearts: number;
  maxHearts: number;
  liesHit: number;
  shielded: boolean;
  status: "playing" | "won" | "lost";
  powerUps: { type: PowerUpType; used: boolean }[];
  versesRestored?: string[];
  verseAssemblyIndices?: number[];
  updatedAt: number;
};

const VERSION = 1;

type MirrorEnvelope = {
  v: number;
  slice: MirrorSlice;
};

function key(sessionId: string, teamId: string): string {
  return `unmasked:${sessionId}:${teamId}`;
}

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readLocalMirror(sessionId: string, teamId: string): MirrorSlice | null {
  const s = storage();
  if (!s) return null;
  try {
    const raw = s.getItem(key(sessionId, teamId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MirrorEnvelope;
    if (!parsed || parsed.v !== VERSION || !parsed.slice) return null;
    return parsed.slice;
  } catch {
    return null;
  }
}

export function writeLocalMirror(
  sessionId: string,
  teamId: string,
  slice: Omit<MirrorSlice, "updatedAt">,
): void {
  const s = storage();
  if (!s) return;
  try {
    const envelope: MirrorEnvelope = {
      v: VERSION,
      slice: { ...slice, updatedAt: Date.now() },
    };
    s.setItem(key(sessionId, teamId), JSON.stringify(envelope));
  } catch {
    /** Quota exceeded / disabled storage: best-effort, silently skip. */
  }
}

export function clearLocalMirror(sessionId: string, teamId: string): void {
  const s = storage();
  if (!s) return;
  try {
    s.removeItem(key(sessionId, teamId));
  } catch {
    /** Ignore. */
  }
}
