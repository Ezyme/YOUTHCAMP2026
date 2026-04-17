import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import mongoose from "mongoose";
import { CAMP_AUTH_COOKIE, isCampGateEnabled } from "@/lib/camp/auth";
import { dbConnect } from "@/lib/db/connect";
import { UnmaskedState } from "@/lib/db/models";
import { computeUnmaskedScore } from "@/lib/games/unmasked/scoring";

async function requireAuth(): Promise<boolean> {
  if (!isCampGateEnabled()) return true;
  const jar = await cookies();
  return jar.get(CAMP_AUTH_COOKIE)?.value === "1";
}

export async function POST(req: Request) {
  try {
    if (!(await requireAuth())) {
      return NextResponse.json({ error: "Login required" }, { status: 401 });
    }
    await dbConnect();
    const body = await req.json();
    const sessionId = String(body.sessionId ?? "");
    const teamId = String(body.teamId ?? "");

    if (!mongoose.isValidObjectId(sessionId) || !mongoose.isValidObjectId(teamId)) {
      return NextResponse.json({ error: "Invalid ids" }, { status: 400 });
    }

    const sid = new mongoose.Types.ObjectId(sessionId);
    const tid = new mongoose.Types.ObjectId(teamId);

    const doc = await UnmaskedState.findOne({ sessionId: sid, teamId: tid }).lean();
    if (!doc) {
      return NextResponse.json({ error: "No game state found" }, { status: 404 });
    }

    if (doc.status === "playing") {
      return NextResponse.json(
        { error: "Finish the board before submitting your score." },
        { status: 400 },
      );
    }

    // Idempotent: once submitted, return the recorded values.
    if (typeof doc.finalScore === "number" && doc.submittedAt) {
      return NextResponse.json({
        ok: true,
        already: true,
        finalScore: doc.finalScore,
        scoreBreakdown: doc.scoreBreakdown,
        submittedAt: doc.submittedAt,
      });
    }

    const revealed = new Set<number>((doc.revealed as number[]) ?? []);
    const gridSize = Number(doc.gridSize);
    const totalLies = Number(doc.totalLies);
    const cells = gridSize * gridSize;
    const totalSafe = Math.max(0, cells - totalLies);

    const lieSet = new Set<number>();
    // The safe-reveal counter treats "lies" as unsafe; everything else counts as revealed-safe.
    // Because we do not rebuild the Board here, rely on `revealed \ lieIndices`. Lie indices are
    // not persisted, so we approximate: revealedSafe = revealed - liesHit (close enough: lies
    // clicked by the player). If a lie was auto-flagged without reveal, it won't be in `revealed`.
    const liesHit = Number(doc.liesHit ?? 0);
    void lieSet;
    const revealedSafe = Math.max(0, revealed.size - liesHit);

    const totalVerses = Array.isArray(doc.verseKeys) ? doc.verseKeys.length : 0;
    const versesRestored = Array.isArray(doc.versesRestored) ? doc.versesRestored.length : 0;

    const { total, breakdown } = computeUnmaskedScore({
      revealedSafe,
      totalSafe,
      versesRestored,
      totalVerses,
      hearts: Number(doc.hearts ?? 0),
      maxHearts: Number(doc.maxHearts ?? 3),
      final: true,
    });

    const submittedAt = new Date();
    await UnmaskedState.updateOne(
      { sessionId: sid, teamId: tid },
      {
        $set: {
          finalScore: total,
          scoreBreakdown: breakdown,
          submittedAt,
        },
      },
    );

    return NextResponse.json({
      ok: true,
      finalScore: total,
      scoreBreakdown: breakdown,
      submittedAt,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
