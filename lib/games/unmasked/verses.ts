import type { VerseFragmentPlacement } from "@/lib/games/unmasked/engine";

/**
 * Scripture pool for Unmasked: **identity in Christ** — who God says we are, chosenness,
 * adoption, new creation, and freedom from condemnation. Passages are split into fragments
 * for the in-game “restore the passage” mechanic (no book/chapter shown on the board).
 */
export type VerseEntry = {
  key: string;
  reference: string;
  /** Full line for admin / tooling; gameplay uses `fragments` in order. */
  full: string;
  fragments: string[];
};

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

/**
 * Pick distinct verses for one board (deterministic from seed).
 * `poolKeys` restricts candidates; empty = all `IDENTITY_VERSES`.
 */
export function pickVersesForGame(
  seed: number,
  count: number,
  poolKeys?: string[],
): VerseEntry[] {
  const rng = mulberry32(seed ^ 0x9e37_79b9);
  let pool = [...IDENTITY_VERSES];
  if (poolKeys && poolKeys.length > 0) {
    const allow = new Set(poolKeys);
    const filtered = IDENTITY_VERSES.filter((v) => allow.has(v.key));
    if (filtered.length >= Math.min(count, 4)) {
      pool = filtered;
    }
  }
  const shuffled = shuffleWithRng(pool, rng);
  const n = Math.max(1, Math.min(count, shuffled.length));
  return shuffled.slice(0, n);
}

/** All fragments for board generation, in verse order (verses then lines). */
export function flattenVersesToFragments(verses: VerseEntry[]): VerseFragmentPlacement[] {
  const out: VerseFragmentPlacement[] = [];
  for (const v of verses) {
    v.fragments.forEach((text, i) => {
      out.push({ text, order: i, verseKey: v.key });
    });
  }
  return out;
}

/**
 * Identity-themed passages (keys are stable for saved `versePoolKeys` / DB).
 */
export const IDENTITY_VERSES: VerseEntry[] = [
  {
    key: "psalm139_14",
    reference: "Psalm 139:14",
    full: "I praise you because I am fearfully and wonderfully made; your works are wonderful",
    fragments: ["I praise you", "because I am", "fearfully and", "wonderfully made"],
  },
  {
    key: "jeremiah1_5",
    reference: "Jeremiah 1:5",
    full: "Before I formed you in the womb I knew you, before you were born I set you apart",
    fragments: [
      "Before I formed you",
      "in the womb",
      "I knew you",
      "before you were born",
      "I set you apart",
    ],
  },
  {
    key: "ephesians2_10",
    reference: "Ephesians 2:10",
    full: "For we are God's handiwork, created in Christ Jesus to do good works, which God prepared in advance for us to do",
    fragments: ["For we are", "God's handiwork", "created in", "Christ Jesus", "to do good works"],
  },
  {
    key: "1peter2_9",
    reference: "1 Peter 2:9",
    full: "You are a chosen people, a royal priesthood, a holy nation, God's special possession",
    fragments: [
      "You are a",
      "chosen people",
      "a royal priesthood",
      "a holy nation",
      "God's special possession",
    ],
  },
  {
    key: "2cor5_17",
    reference: "2 Corinthians 5:17",
    full: "If anyone is in Christ, the new creation has come: The old has gone, the new is here!",
    fragments: [
      "If anyone is in Christ",
      "the new creation has come",
      "The old has gone",
      "the new is here",
    ],
  },
  {
    key: "romans8_37",
    reference: "Romans 8:37",
    full: "In all these things we are more than conquerors through him who loved us",
    fragments: ["In all these things", "we are more than", "conquerors through him", "who loved us"],
  },
  {
    key: "galatians2_20",
    reference: "Galatians 2:20",
    full: "I have been crucified with Christ and I no longer live, but Christ lives in me",
    fragments: [
      "I have been crucified",
      "with Christ and",
      "I no longer live",
      "but Christ lives in me",
    ],
  },
  {
    key: "isaiah43_1",
    reference: "Isaiah 43:1",
    full: "Do not fear, for I have redeemed you; I have summoned you by name; you are mine",
    fragments: [
      "Do not fear",
      "for I have redeemed you",
      "I have summoned you",
      "by name",
      "you are mine",
    ],
  },
  {
    key: "john1_12",
    reference: "John 1:12",
    full: "Yet to all who did receive him, to those who believed in his name, he gave the right to become children of God",
    fragments: [
      "Yet to all who",
      "did receive him",
      "to those who believed in his name",
      "he gave the right",
      "to become children of God",
    ],
  },
  {
    key: "deut31_6",
    reference: "Deuteronomy 31:6",
    full: "Be strong and courageous. Do not be afraid, for the Lord your God goes with you; he will never leave you nor forsake you",
    fragments: [
      "Be strong and courageous",
      "Do not be afraid",
      "for the Lord your God",
      "goes with you",
      "he will never leave you",
      "nor forsake you",
    ],
  },
  {
    key: "romans8_1",
    reference: "Romans 8:1",
    full: "Therefore, there is now no condemnation for those who are in Christ Jesus",
    fragments: ["Therefore, there is now no condemnation", "for those who are", "in Christ Jesus"],
  },
  {
    key: "colossians3_3",
    reference: "Colossians 3:3",
    full: "For you died, and your life is now hidden with Christ in God",
    fragments: ["For you died", "and your life is now hidden", "with Christ in God"],
  },
  {
    key: "1john3_1",
    reference: "1 John 3:1",
    full: "See what great love the Father has lavished on us, that we should be called children of God! And that is what we are!",
    fragments: [
      "See what great love",
      "the Father has lavished on us",
      "that we should be called",
      "children of God",
      "And that is what we are",
    ],
  },
  {
    key: "ephesians1_5",
    reference: "Ephesians 1:5",
    full: "He predestined us for adoption to sonship through Jesus Christ, in accordance with his pleasure and will",
    fragments: [
      "He predestined us",
      "for adoption to sonship",
      "through Jesus Christ",
      "in accordance with his pleasure and will",
    ],
  },
  {
    key: "zephaniah3_17",
    reference: "Zephaniah 3:17",
    full: "The Lord your God is with you, the Mighty Warrior who saves. He will take great delight in you; in his love he will no longer rebuke you, but will rejoice over you with singing",
    fragments: [
      "The Lord your God is with you",
      "the Mighty Warrior who saves",
      "He will take great delight in you",
      "in his love he will rejoice over you",
    ],
  },
  {
    key: "romans12_2",
    reference: "Romans 12:2",
    full: "Do not conform to the pattern of this world, but be transformed by the renewing of your mind",
    fragments: [
      "Do not conform",
      "to the pattern of this world",
      "but be transformed",
      "by the renewing of your mind",
    ],
  },
];

export function getVerseByKey(key: string): VerseEntry | undefined {
  return IDENTITY_VERSES.find((v) => v.key === key);
}

export function getVerseFragmentsForBoard(key: string): VerseFragmentPlacement[] {
  const verse = getVerseByKey(key);
  if (!verse) return [];
  return verse.fragments.map((text, i) => ({
    text,
    order: i,
    verseKey: verse.key,
  }));
}
