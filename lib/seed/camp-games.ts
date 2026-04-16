import type { EngineKey, ScoringMode } from "@/lib/db/models";

type SeedGame = {
  name: string;
  slug: string;
  day: number;
  category: string;
  engineKey: EngineKey;
  isPlayable: boolean;
  order: number;
  scoringMode?: ScoringMode;
  placementPoints?: number[];
  weight?: number;
  rulesMarkdown?: string;
  /** Optional engine settings (e.g. Unmasked grid / verses). */
  settings?: Record<string, unknown>;
};

const defaultPoints = [12, 11, 10, 9, 8, 7];

export const CAMP_GAMES: SeedGame[] = [
  {
    name: "Build a Bridge",
    slug: "build-a-bridge",
    day: 0,
    category: "Day 0",
    engineKey: "config_only",
    isPlayable: false,
    order: 10,
  },
  {
    name: "Card Decks",
    slug: "card-decks",
    day: 0,
    category: "Day 0",
    engineKey: "config_only",
    isPlayable: false,
    order: 20,
  },
  {
    name: "Straw iLONG Race",
    slug: "straw-ilong-race",
    day: 0,
    category: "Day 0",
    engineKey: "config_only",
    isPlayable: false,
    order: 30,
  },
  {
    name: "Salbabida Race",
    slug: "salbabida-race",
    day: 1,
    category: "Pool Games",
    engineKey: "config_only",
    isPlayable: false,
    order: 40,
  },
  {
    name: "Pingpong Ball Race",
    slug: "pingpong-ball-race",
    day: 1,
    category: "Pool Games",
    engineKey: "config_only",
    isPlayable: false,
    order: 50,
  },
  {
    name: "Water Tray Relay",
    slug: "water-tray-relay",
    day: 1,
    category: "Pool Games",
    engineKey: "config_only",
    isPlayable: false,
    order: 60,
  },
  {
    name: "Leap of Faith (Jump Rope Relay)",
    slug: "leap-of-faith",
    day: 2,
    category: "Group Games",
    engineKey: "config_only",
    isPlayable: false,
    order: 70,
  },
  {
    name: "Luksong Palaka",
    slug: "luksong-palaka",
    day: 2,
    category: "Group Games",
    engineKey: "config_only",
    isPlayable: false,
    order: 80,
  },
  {
    name: "Collect the Flags",
    slug: "collect-the-flags",
    day: 2,
    category: "Group Games",
    engineKey: "config_only",
    isPlayable: false,
    order: 90,
  },
  {
    name: "Amazing Race (overall)",
    slug: "amazing-race",
    day: 2,
    category: "Amazing Race",
    engineKey: "config_only",
    isPlayable: false,
    order: 95,
    scoringMode: "amazing_race_finish",
    /** Double weight vs typical games — same 1st–6th row as others but each point ×2 (major swing leg). */
    weight: 2,
    rulesMarkdown:
      "Rank teams by **finish order** (first team to complete the full race = 1st). This leg uses **2× weight** on the standard point row so it can swing the camp standings. Use the Scoring admin to record placements from completion order.",
  },
  {
    name: "Connect the Ball",
    slug: "connect-the-ball",
    day: 2,
    category: "Amazing Race",
    engineKey: "config_only",
    isPlayable: false,
    order: 100,
    weight: 0,
    rulesMarkdown:
      "Amazing Race station. Clues can be linked to this game slug in the Clues admin.",
  },
  {
    name: "Unmasked",
    slug: "unmasked",
    day: 2,
    category: "Amazing Race",
    engineKey: "unmasked",
    isPlayable: true,
    order: 115,
    weight: 0,
    settings: {
      gridSize: 20,
      difficulty: "intense",
      verseCount: 4,
      versePoolKeys: [] as string[],
    },
    rulesMarkdown:
      "**Identity Minefield** — default **20×20** board (~**28%** lies on **Intense**). Multiple Scripture passages (no references), fragment stack & builder, passage checks for score. Tap to reveal, long-press to flag. Use the side power-up rail for hover tips and locked/redeemed status. Amazing Race codes can unlock hearts, reveals, scouts, shields, safe openings, Truth Radar, Lie Pin, Verse Compass, and Gentle Step.",
  },
  {
    name: "Mindgame",
    slug: "mindgame",
    day: 2,
    category: "Amazing Race",
    engineKey: "mindgame",
    isPlayable: true,
    order: 110,
    weight: 0,
    rulesMarkdown:
      "Lattice puzzle: pins on **line crossings**. **One adjacent step per tap**. **Diagonals** only in the small deep core. Default **12×4**, **10 pins** in a **single vertical file** (center column) with a **goal-specific scramble** (zig-zag for high→low, mirror zig for low→high, evens-before-odds block for odd/even mode). Tap **Apply new board** after edits.",
  },
  {
    name: "Doctor Quack2x",
    slug: "doctor-quack2x",
    day: 2,
    category: "Amazing Race",
    engineKey: "config_only",
    isPlayable: false,
    order: 120,
    weight: 0,
  },
  {
    name: "Sipa Challenge",
    slug: "sipa-challenge",
    day: 2,
    category: "Amazing Race",
    engineKey: "config_only",
    isPlayable: false,
    order: 130,
    weight: 0,
  },
  {
    name: "Sack Race DUO",
    slug: "sack-race-duo",
    day: 2,
    category: "Amazing Race",
    engineKey: "config_only",
    isPlayable: false,
    order: 140,
    weight: 0,
  },
  {
    name: "Obstacle Course",
    slug: "obstacle-course",
    day: 2,
    category: "Amazing Race",
    engineKey: "config_only",
    isPlayable: false,
    order: 150,
    weight: 0,
  },
  {
    name: "Final Solving",
    slug: "final-solving",
    day: 2,
    category: "Amazing Race",
    engineKey: "final_solving",
    isPlayable: true,
    order: 200,
    rulesMarkdown:
      "**Final stage — clue synthesis.** Combine every fragment your team earned along the Amazing Race. Facilitators configure the sealed answer in Admin (Final puzzle). The in-app room is styled as a last **riddle / survival-game** challenge: use your collected cards, then submit one answer to clear the game.",
  },
];

export function scoringForSeed(g: SeedGame) {
  return {
    maxPlacements: 6,
    scoringMode: g.scoringMode ?? "placement_points",
    placementPoints: g.placementPoints ?? defaultPoints,
    weight: g.weight ?? 1,
  };
}
