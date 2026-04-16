import {
  boardMaxAdjacentClue,
  generateBoard,
  resolveUnmaskedLieCount,
  type VerseFragmentPlacement,
} from "@/lib/games/unmasked/engine";
import { flattenVersesToFragments, pickVersesForGame } from "@/lib/games/unmasked/verses";

function expandGridIfNeeded(
  gridSize: number,
  fragCount: number,
  settings: Record<string, unknown>,
): number {
  let g = gridSize;
  while (g <= 32) {
    const lies = resolveUnmaskedLieCount(g, fragCount, settings);
    const safe = g * g - lies;
    if (safe >= fragCount) return g;
    g += 2;
  }
  return g;
}

export type PlannedUnmaskedLayout = {
  seed: number;
  gridSize: number;
  totalLies: number;
  verseKeys: string[];
  verseFragments: { index: number; text: string; order: number; verseKey: string }[];
};

/**
 * Build a new board layout from game definition settings.
 * @param baseSeed — definition seed, or a fresh value when reshuffling
 */
export function planUnmaskedLayout(
  settings: Record<string, unknown>,
  baseSeed: number,
): PlannedUnmaskedLayout {
  const difficulty = String(settings.difficulty ?? "medium");
  const verseCount = Math.max(4, Number(settings.verseCount ?? 4));
  const poolRaw = settings.versePoolKeys;
  const versePoolKeys = Array.isArray(poolRaw) ? poolRaw.map(String).filter(Boolean) : [];

  const verses = pickVersesForGame(
    baseSeed ^ 0x51ed,
    verseCount,
    versePoolKeys.length ? versePoolKeys : undefined,
  );
  const verseKeys = verses.map((v) => v.key);
  const flatFrags: VerseFragmentPlacement[] = flattenVersesToFragments(verses);

  let gridSize = Math.min(24, Math.max(8, Number(settings.gridSize ?? 16)));
  gridSize = expandGridIfNeeded(gridSize, flatFrags.length, settings);

  let workingSeed = baseSeed;
  let totalLies = resolveUnmaskedLieCount(gridSize, flatFrags.length, settings);
  let board = generateBoard(workingSeed, gridSize, totalLies, flatFrags);

  const lieCap = gridSize * gridSize - flatFrags.length - 1;
  const huntClue5 = ["hard", "expert", "intense"].includes(difficulty);
  if (huntClue5 && lieCap >= 5) {
    let tries = 0;
    while (boardMaxAdjacentClue(board) < 5 && tries < 900) {
      tries += 1;
      board = generateBoard(workingSeed + tries, gridSize, totalLies, flatFrags);
    }
    if (boardMaxAdjacentClue(board) >= 5) {
      workingSeed += tries;
    } else if (totalLies < lieCap) {
      totalLies = Math.min(
        lieCap,
        totalLies + Math.max(4, Math.floor(gridSize * gridSize * 0.035)),
      );
      tries = 0;
      board = generateBoard(workingSeed, gridSize, totalLies, flatFrags);
      while (boardMaxAdjacentClue(board) < 5 && tries < 900) {
        tries += 1;
        board = generateBoard(workingSeed + tries, gridSize, totalLies, flatFrags);
      }
      if (boardMaxAdjacentClue(board) >= 5) workingSeed += tries;
    }
  }

  const verseFragments = board.verseIndices.map((tileIdx, i) => ({
    index: tileIdx,
    text: flatFrags[i].text,
    order: flatFrags[i].order,
    verseKey: flatFrags[i].verseKey,
  }));

  return {
    seed: workingSeed,
    gridSize,
    totalLies,
    verseKeys,
    verseFragments,
  };
}
