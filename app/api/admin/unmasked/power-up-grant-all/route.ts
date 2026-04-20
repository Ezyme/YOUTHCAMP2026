import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/admin-auth";
import { dbConnect } from "@/lib/db/connect";
import { PowerUpCode, Team, UnmaskedState, type PowerUpType } from "@/lib/db/models";
import { buildUnmaskedGrantUpdateForPowerUp } from "@/lib/games/unmasked/redemption-grant";
import mongoose from "mongoose";

function parseOid(id: unknown): mongoose.Types.ObjectId | null {
  if (typeof id !== "string" || !mongoose.isValidObjectId(id)) return null;
  return new mongoose.Types.ObjectId(id);
}

/**
 * Marks the code redeemed for every eligible team and applies the same Unmasked grant
 * as manual redeem for teams that already have a saved game. Teams with no Unmasked
 * state yet are only listed on the code; they receive the grant on first open via the
 * redeem repair path, or when they create state and you run this again.
 */
export async function POST(req: Request) {
  try {
    if (!(await verifyAdminRequest())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    await dbConnect();
    const body = await req.json().catch(() => ({}));
    const sessionId = parseOid(body.sessionId);
    const codeId = parseOid(body.codeId);
    if (!sessionId || !codeId) {
      return NextResponse.json({ error: "sessionId and codeId required" }, { status: 400 });
    }

    const codeDoc = await PowerUpCode.findOne({ _id: codeId, sessionId }).lean();
    if (!codeDoc) {
      return NextResponse.json({ error: "Code not found for this session" }, { status: 404 });
    }

    if (codeDoc.scope === "per_team" && !codeDoc.teamId) {
      return NextResponse.json(
        { error: "This per-team code has no team assigned" },
        { status: 400 },
      );
    }

    let targetTeamIds: mongoose.Types.ObjectId[];
    if (codeDoc.scope === "per_team" && codeDoc.teamId) {
      targetTeamIds = [codeDoc.teamId as mongoose.Types.ObjectId];
    } else {
      const teams = await Team.find({ sessionId }).select("_id").lean();
      targetTeamIds = teams.map((t) => t._id as mongoose.Types.ObjectId);
    }

    if (targetTeamIds.length === 0) {
      return NextResponse.json({ error: "No teams in this session" }, { status: 400 });
    }

    const codeUpper = String(codeDoc.code).trim().toUpperCase();
    const type = codeDoc.powerUpType as PowerUpType;

    await PowerUpCode.updateOne(
      { _id: codeDoc._id },
      { $addToSet: { redeemedBy: { $each: targetTeamIds } } },
    );

    let grantedUnmaskedStates = 0;
    let skippedAlreadyHadCode = 0;
    let teamsWithoutUnmaskedState = 0;

    for (const tid of targetTeamIds) {
      const state = await UnmaskedState.findOne({ sessionId, teamId: tid }).lean();
      if (!state) {
        teamsWithoutUnmaskedState++;
        continue;
      }
      const redeemedCodes = (state.redeemedCodes as string[] | undefined) ?? [];
      if (redeemedCodes.includes(codeUpper)) {
        skippedAlreadyHadCode++;
        continue;
      }
      const update = buildUnmaskedGrantUpdateForPowerUp(codeUpper, type);
      await UnmaskedState.updateOne({ sessionId, teamId: tid }, update);
      grantedUnmaskedStates++;
    }

    return NextResponse.json({
      ok: true,
      targetTeamCount: targetTeamIds.length,
      grantedUnmaskedStates,
      skippedAlreadyHadCode,
      teamsWithoutUnmaskedState,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
