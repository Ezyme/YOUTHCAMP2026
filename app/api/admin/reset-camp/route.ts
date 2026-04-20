import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/admin-auth";
import { dbConnect } from "@/lib/db/connect";
import {
  GameResult,
  MindgameState,
  PowerUpCode,
  Session,
  UnmaskedState,
} from "@/lib/db/models";

/**
 * Clears all scores and team play state for the active camp session.
 * Keeps game definitions (`GameDefinition`) and team rows (`Team`) unchanged.
 */
export async function POST() {
  try {
    if (!(await verifyAdminRequest())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    await dbConnect();
    const session = await Session.findOne({ active: true }).lean();
    if (!session) {
      return NextResponse.json(
        { error: "No active session — run seed first" },
        { status: 400 },
      );
    }
    const sessionId = session._id;

    const [
      gameResultsDeleted,
      mindgameDeleted,
      unmaskedDeleted,
      powerUpRedemptionsCleared,
    ] = await Promise.all([
      GameResult.deleteMany({ sessionId }),
      MindgameState.deleteMany({ sessionId }),
      UnmaskedState.deleteMany({ sessionId }),
      PowerUpCode.updateMany({ sessionId }, { $set: { redeemedBy: [] } }),
    ]);

    return NextResponse.json({
      ok: true,
      sessionId: String(sessionId),
      deletedGameResults: gameResultsDeleted.deletedCount,
      deletedMindgameStates: mindgameDeleted.deletedCount,
      deletedUnmaskedStates: unmaskedDeleted.deletedCount,
      powerUpCodesRedemptionsCleared: powerUpRedemptionsCleared.modifiedCount,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
