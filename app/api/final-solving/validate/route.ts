import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db/connect";
import { FinalPuzzle } from "@/lib/db/models";
import { checkAnswer } from "@/lib/games/final-solving/validate-answer";
import mongoose from "mongoose";

export async function POST(req: Request) {
  try {
    await dbConnect();
    const body = await req.json();
    const sessionId = String(body.sessionId ?? "");
    const answer = String(body.answer ?? "");
    const teamId = body.teamId ? String(body.teamId) : null;

    if (!mongoose.isValidObjectId(sessionId)) {
      return NextResponse.json({ error: "Invalid session" }, { status: 400 });
    }

    let puzzle = teamId && mongoose.isValidObjectId(teamId)
      ? await FinalPuzzle.findOne({
          sessionId,
          teamId,
        }).lean()
      : null;
    if (!puzzle) {
      puzzle = await FinalPuzzle.findOne({
        sessionId,
        teamId: null,
      }).lean();
    }
    if (!puzzle) {
      return NextResponse.json(
        { ok: false, error: "No puzzle configured" },
        { status: 404 },
      );
    }

    const ok = checkAnswer(
      puzzle.validatorType,
      (puzzle.validatorConfig ?? {}) as Record<string, unknown>,
      answer,
      puzzle.solutionHash,
    );
    return NextResponse.json({ ok });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
