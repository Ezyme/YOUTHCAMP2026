import type { Types } from "mongoose";
import { Clue, FinalPuzzle, Team } from "@/lib/db/models";
import { hashPlainForValidator } from "@/lib/games/final-solving/validate-answer";

/**
 * Demo final answer for seeded clues + global Final puzzle (normalized).
 * Teams combine fragment clues from the race; do not expose this in client APIs.
 */
export const SEED_FINAL_ANSWER_PLAIN = "nine of hearts";

type SeedClueRow = {
  order: number;
  sourceGameSlug: string;
  /** Shown to every team; include {team} for the team name. */
  text: string;
};

const SEED_CLUES: SeedClueRow[] = [
  {
    order: 1,
    sourceGameSlug: "connect-the-ball",
    text: "For {team}: Fragment A — Counting ranks: the number between eight and ten, spelled out in one word.",
  },
  {
    order: 2,
    sourceGameSlug: "mindgame",
    text: 'Fragment B — A tiny word that often sits between a quantity and what it belongs to (two letters).',
  },
  {
    order: 3,
    sourceGameSlug: "amazing-race",
    text: "Fragment C — In a standard deck, the red suit drawn like a leaf; name it in lowercase, plural.",
  },
  {
    order: 4,
    sourceGameSlug: "collect-the-flags",
    text: "Final synthesis: join A, then B, then C with single spaces between. Submit that full phrase (lowercase).",
  },
];

/**
 * Upserts a global Final puzzle for the session and one clue chain per team.
 * Idempotent: same (sessionId, teamId, sourceGameSlug, order) is updated on re-seed.
 */
export async function syncFinalPuzzleAndClues(sessionId: Types.ObjectId): Promise<{
  finalPuzzleUpserted: boolean;
  cluesUpserted: number;
}> {
  const solutionHash = hashPlainForValidator(
    "normalized",
    SEED_FINAL_ANSWER_PLAIN,
    {},
  );

  await FinalPuzzle.findOneAndUpdate(
    { sessionId, teamId: null },
    {
      $set: {
        sessionId,
        teamId: null,
        validatorType: "normalized" as const,
        validatorConfig: {},
        solutionHash,
      },
    },
    { upsert: true, new: true },
  );

  const teams = await Team.find({ sessionId }).sort({ sortOrder: 1 }).lean();
  let cluesUpserted = 0;

  for (const team of teams) {
    const teamId = team._id as Types.ObjectId;
    const teamName = team.name ?? "Team";
    for (const row of SEED_CLUES) {
      const text = row.text.includes("{team}")
        ? row.text.replace(/\{team\}/g, teamName)
        : row.text;
      await Clue.findOneAndUpdate(
        {
          sessionId,
          teamId,
          sourceGameSlug: row.sourceGameSlug,
          order: row.order,
        },
        {
          $set: {
            sessionId,
            teamId,
            sourceGameSlug: row.sourceGameSlug,
            order: row.order,
            text: `[Seed] ${text}`,
          },
        },
        { upsert: true, new: true },
      );
      cluesUpserted++;
    }
  }

  return { finalPuzzleUpserted: true, cluesUpserted };
}
