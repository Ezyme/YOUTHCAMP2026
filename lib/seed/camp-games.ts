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
  /** For manual_points — max weighted pts per team (e.g. 10 or 20). */
  manualPointsMax?: number;
  rulesMarkdown?: string;
  /** Optional engine settings (e.g. Unmasked grid / verses). */
  settings?: Record<string, unknown>;
};

/** Default row for games that don’t set placementPoints (e.g. manual categories). */
const defaultPoints = [12, 11, 10, 9, 8, 7];

/** Pingpong Ball Race, Water Tray Relay, Leap of Faith, Luksong Palaka — 1st→6th. */
const ROW_LIGHT = [15, 13, 11, 10, 9, 8, 7];

/** Salbabida Race, Collect the Flags — 1st→6th (Collect uses 2× weight vs this row). */
const ROW_HEAVY = [20, 18, 16, 15, 14, 13];

/** Amazing Race — 1st→6th (30% of /100 camp total). */
const AMAZING_RACE_POINTS = [30, 28, 26, 25, 24, 23];

/**
 * Six team mini-games (pool + field) must combine to **25 / 100** max if a team
 * places 1st in every event. Raw placement rows sum to 120 at 1st; scale by 25/120.
 * Collect the Flags counts as **2×** the heavy row → use weight 2× vs other games.
 */
const W_TEAM_MINI = 25 / 120;
const W_COLLECT_FLAGS = 50 / 120;

/** Shown in rules — camp total is /100 with these pillars. */
const RUBRIC_100 =
  "**Camp total = /100:** Merit **5%** · Pool + field team games **25%** combined · Amazing Race **30%** · Flag **10%** · Cheer **10%** · Group skit **20%**.";

export const CAMP_GAMES: SeedGame[] = [
  {
    name: "Merit points (Dog tags)",
    slug: "merit-points-reference",
    day: 0,
    category: "Merit",
    engineKey: "config_only",
    isPlayable: false,
    order: 10,
    weight: 1,
    scoringMode: "manual_points",
    manualPointsMax: 5,
    placementPoints: defaultPoints,
    rulesMarkdown: `${RUBRIC_100}\n\n**This row — max 5 / 100 per team.** Enter values in **Admin → Scoring** after you tally offline (e.g. tags).`,
  },
  {
    name: "Salbabida Race",
    slug: "salbabida-race",
    day: 1,
    category: "Pool games",
    engineKey: "config_only",
    isPlayable: false,
    order: 40,
    placementPoints: ROW_HEAVY,
    weight: W_TEAM_MINI,
    rulesMarkdown: `${RUBRIC_100}\n\n**Team games (six events)** share the **25%** pillar; weights scale rows so the six add up to that slice on /100. This event: row **20 · 18 · 16 · 15 · 14 · 13**. Enter **1st–6th** in **Admin → Scoring**.`,
  },
  {
    name: "Pingpong Ball Race",
    slug: "pingpong-ball-race",
    day: 1,
    category: "Pool games",
    engineKey: "config_only",
    isPlayable: false,
    order: 50,
    placementPoints: ROW_LIGHT,
    weight: W_TEAM_MINI,
    rulesMarkdown: `${RUBRIC_100}\n\nRow **15 · 13 · 11 · 10 · 9 · 8 · 7**. Enter finish order in **Admin → Scoring**.`,
  },
  {
    name: "Water Tray Relay",
    slug: "water-tray-relay",
    day: 1,
    category: "Pool games",
    engineKey: "config_only",
    isPlayable: false,
    order: 60,
    placementPoints: ROW_LIGHT,
    weight: W_TEAM_MINI,
    rulesMarkdown: `${RUBRIC_100}\n\nRow **15 · 13 · 11 · 10 · 9 · 8 · 7**. Enter finish order in **Admin → Scoring**.`,
  },
  {
    name: "Leap of Faith (Jump Rope Relay)",
    slug: "leap-of-faith",
    day: 2,
    category: "Field games",
    engineKey: "config_only",
    isPlayable: false,
    order: 70,
    placementPoints: ROW_LIGHT,
    weight: W_TEAM_MINI,
    rulesMarkdown: `${RUBRIC_100}\n\nRow **15 · 13 · 11 · 10 · 9 · 8 · 7**. Enter finish order in **Admin → Scoring**.`,
  },
  {
    name: "Luksong Palaka",
    slug: "luksong-palaka",
    day: 2,
    category: "Field games",
    engineKey: "config_only",
    isPlayable: false,
    order: 80,
    placementPoints: ROW_LIGHT,
    weight: W_TEAM_MINI,
    rulesMarkdown: `${RUBRIC_100}\n\nRow **15 · 13 · 11 · 10 · 9 · 8 · 7**. Enter finish order in **Admin → Scoring**.`,
  },
  {
    name: "Collect the Flags",
    slug: "collect-the-flags",
    day: 2,
    category: "Field games",
    engineKey: "config_only",
    isPlayable: false,
    order: 90,
    placementPoints: ROW_HEAVY,
    weight: W_COLLECT_FLAGS,
    rulesMarkdown: `${RUBRIC_100}\n\n**2×** vs the same heavy row as Salbabida — row **20 · 18 · 16 · 15 · 14 · 13** with double weight so this leg counts twice. Enter finish order in **Admin → Scoring**.`,
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
    placementPoints: AMAZING_RACE_POINTS,
    weight: 1,
    rulesMarkdown: `${RUBRIC_100}\n\n**30 / 100** from finish order below (1st→6th). Playable stations (**Mindgame**, **Unmasked**) are **not** separate scored rows.`,
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
    rulesMarkdown: `**Identity Minefield**

Reveal every safe tile on the 20×20 board (~28% lies on Intense). Tap to reveal, long-press to flag a suspected lie.

Once the board is cleared:
- Drag fragments from the **Stack** into the **Builder row** in reading order.
- Tap **Check passage** to score. Each wrong check adds 30 s to your time and reveals a citation clue.

**Amazing Race codes** unlock Abundant Grace, Glimmer of Hope, Prophetic Vision, Armor of Truth, Divine Blueprint, Light of Discernment, Exposing the Dark, Living Word, and Steadfast Path.`,
  },
  {
    name: "Flag (Camper's Night)",
    slug: "campers-night-flag",
    day: 2,
    category: "Camper's Night",
    engineKey: "config_only",
    isPlayable: false,
    order: 160,
    weight: 1,
    scoringMode: "manual_points",
    manualPointsMax: 10,
    placementPoints: defaultPoints,
    rulesMarkdown: `${RUBRIC_100}\n\n**10 / 100** — enter scores in **Admin → Scoring**.\n\nJudges may use **raw max 25** with sub-criteria:\n- Relevance to Theme — 10\n- Neatness — 5\n- Meaning — 5\n- Creativity — 5`,
  },
  {
    name: "Cheer (Camper's Night)",
    slug: "campers-night-cheer",
    day: 2,
    category: "Camper's Night",
    engineKey: "config_only",
    isPlayable: false,
    order: 170,
    weight: 1,
    scoringMode: "manual_points",
    manualPointsMax: 10,
    placementPoints: defaultPoints,
    rulesMarkdown: `${RUBRIC_100}\n\n**10 / 100** — enter scores in **Admin → Scoring**.\n\nJudges may use **raw max 25** with sub-criteria:\n- Energy — 5\n- Relevance to Theme — 5\n- Clarity and Delivery — 5\n- Choreography — 5\n- Coordination and Teamwork — 5`,
  },
  {
    name: "Group skit / Presentation (Camper's Night)",
    slug: "campers-night-presentation",
    day: 2,
    category: "Camper's Night",
    engineKey: "config_only",
    isPlayable: false,
    order: 180,
    weight: 1,
    scoringMode: "manual_points",
    manualPointsMax: 20,
    placementPoints: defaultPoints,
    rulesMarkdown: `${RUBRIC_100}\n\n**20 / 100** — enter scores in **Admin → Scoring**.\n\nJudges may use **raw max 50** with sub-criteria:\n- Relevance to Theme — 20\n- Teamwork (lahat may ganap) — 10\n- WOW Factor (Creativity) — 10\n- Resourcefulness — 10`,
  },
];

export function scoringForSeed(g: SeedGame) {
  const base = {
    maxPlacements: 6,
    scoringMode: g.scoringMode ?? "placement_points",
    placementPoints: g.placementPoints ?? defaultPoints,
    weight: g.weight ?? 1,
  };
  if (g.manualPointsMax != null) {
    return { ...base, manualPointsMax: g.manualPointsMax };
  }
  return base;
}
