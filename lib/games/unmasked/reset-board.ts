import {
  GameDefinition,
  PowerUpCode,
  UnmaskedState,
  type PowerUpType,
} from "@/lib/db/models";
import { powerUpEntriesForRedemption } from "@/lib/games/unmasked/redeem-grants";
import { planUnmaskedLayout } from "@/lib/games/unmasked/plan-layout";
import mongoose from "mongoose";

/**
 * Same as in-game “New board”: reshuffle minefield, reset passages, keep redeemed
 * codes and the run timer (`startedAt`), refresh power-ups from codes.
 */
export async function resetUnmaskedBoardKeepTimer(
  sessionId: mongoose.Types.ObjectId,
  teamId: mongoose.Types.ObjectId,
  slug: string,
): Promise<Record<string, unknown> | null> {
  const existing = await UnmaskedState.findOne({ sessionId, teamId }).lean();
  if (!existing) return null;

  const preservedStartedAt = existing.startedAt ?? new Date();

  const game = await GameDefinition.findOne({ slug }).lean();
  const settings = (game?.settings ?? {}) as Record<string, unknown>;
  const freshSeed =
    (Math.floor(Math.random() * 0x7fff_ffff) ^ Date.now()) % 0x7fff_ffff;
  const layout = planUnmaskedLayout(settings, freshSeed);

  const keptRedeemed = (existing.redeemedCodes as string[] | undefined) ?? [];
  const freshPowerUps: { type: PowerUpType; used: boolean }[] = [];
  let bonusHearts = 0;
  let bonusShield = false;
  if (keptRedeemed.length > 0) {
    const upperCodes = keptRedeemed.map((c) => String(c).trim().toUpperCase()).filter(Boolean);
    const unique = [...new Set(upperCodes)];
    const codeRows = await PowerUpCode.find({
      sessionId,
      code: { $in: unique },
    })
      .select({ code: 1, powerUpType: 1 })
      .lean();
    const typeByCode = new Map<string, PowerUpType>();
    for (const row of codeRows) {
      typeByCode.set(String(row.code).toUpperCase(), row.powerUpType as PowerUpType);
    }
    for (const raw of keptRedeemed) {
      const u = String(raw).trim().toUpperCase();
      const t = typeByCode.get(u);
      if (!t) continue;
      const entries = powerUpEntriesForRedemption(t);
      if (t === "extra_heart") {
        bonusHearts += entries.length;
        for (const e of entries) freshPowerUps.push({ ...e, used: true });
      } else if (t === "shield") {
        bonusShield = true;
        for (const e of entries) freshPowerUps.push({ ...e, used: true });
      } else {
        freshPowerUps.push(...entries);
      }
    }
  }

  const doc = await UnmaskedState.findOneAndUpdate(
    { sessionId, teamId },
    {
      $set: {
        seed: layout.seed,
        gridSize: layout.gridSize,
        totalLies: layout.totalLies,
        verseKeys: layout.verseKeys,
        verseFragments: layout.verseFragments,
        revealed: [],
        flagged: [],
        hearts: 3 + bonusHearts,
        maxHearts: 3 + bonusHearts,
        verseAssemblyIndices: [],
        versesRestored: [],
        verseCheckAttemptsByKey: {},
        versesGivenUp: [],
        verseScore: 0,
        redeemedCodes: keptRedeemed,
        powerUps: freshPowerUps,
        shielded: bonusShield,
        status: "playing",
        liesHit: 0,
        startedAt: preservedStartedAt,
        passagesComplete: false,
        checkPassagePenaltySeconds: 0,
      },
      $unset: {
        finishedAt: 1,
        finalScore: 1,
        scoreBreakdown: 1,
        submittedAt: 1,
      },
    },
    { new: true },
  ).lean();

  return doc as unknown as Record<string, unknown> | null;
}
