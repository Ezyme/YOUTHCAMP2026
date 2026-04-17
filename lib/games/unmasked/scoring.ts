/**
 * Unmasked 0-100 score.
 *
 * Weighting (per user choice):
 *   Board progress  = 60 × (revealedSafe / totalSafe)
 *   Verses restored = 30 × (versesRestored / totalVerses)
 *                     (if no verses exist on the board, that 30 rolls into board → 90)
 *   Heart efficiency = 10 × (hearts / maxHearts)
 *     - Counted for the final score. During play it shows "potential" — we still
 *       include the live value so the live badge is a fair preview.
 */
export type UnmaskedScoreBreakdown = {
  board: number;
  verses: number;
  hearts: number;
};

export type UnmaskedScoreArgs = {
  revealedSafe: number;
  totalSafe: number;
  versesRestored: number;
  totalVerses: number;
  hearts: number;
  maxHearts: number;
  /** Pass true once the game status is "won" / "lost" to lock heart bonus into the total. */
  final?: boolean;
};

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n <= 0) return 0;
  if (n >= 1) return 1;
  return n;
}

export function computeUnmaskedScore(args: UnmaskedScoreArgs): {
  total: number;
  breakdown: UnmaskedScoreBreakdown;
} {
  const boardRatio = args.totalSafe > 0 ? clamp01(args.revealedSafe / args.totalSafe) : 0;
  const hasVerses = args.totalVerses > 0;
  const verseRatio = hasVerses ? clamp01(args.versesRestored / args.totalVerses) : 0;
  const heartRatio = args.maxHearts > 0 ? clamp01(args.hearts / args.maxHearts) : 0;

  // If there are no verses on this board, the 30 verse-points fold into board → max 90 from board.
  const boardWeight = hasVerses ? 60 : 90;
  const verseWeight = hasVerses ? 30 : 0;
  const heartWeight = 10;

  const board = Math.round(boardWeight * boardRatio);
  const verses = Math.round(verseWeight * verseRatio);
  const hearts = Math.round(heartWeight * heartRatio);

  const total = board + verses + hearts;
  return {
    total: Math.min(100, Math.max(0, total)),
    breakdown: { board, verses, hearts },
  };
}

/** Only the /100 score’s “Verses” row (0–30), same formula as {@link computeUnmaskedScore}. */
export function versesSlicePoints(versesRestored: number, totalVerses: number): number {
  if (totalVerses <= 0) return 0;
  const verseRatio = clamp01(versesRestored / totalVerses);
  return Math.round(30 * verseRatio);
}

/**
 * How much the /100 “Verses” slice increases when one more passage is restored.
 * (Often ~8 when going from 0→1 of 4 passages — unrelated to fragment/line count.)
 */
export function marginalVersesSliceDelta(prevRestoredCount: number, totalVerses: number): number {
  if (totalVerses <= 0) return 0;
  return (
    versesSlicePoints(prevRestoredCount + 1, totalVerses) -
    versesSlicePoints(prevRestoredCount, totalVerses)
  );
}
