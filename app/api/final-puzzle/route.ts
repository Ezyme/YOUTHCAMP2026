import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db/connect";
import { FinalPuzzle } from "@/lib/db/models";
import { hashPlainForValidator } from "@/lib/games/final-solving/validate-answer";
import mongoose from "mongoose";

function withoutHash<T extends { solutionHash?: string }>(doc: T) {
  const { solutionHash: _s, ...rest } = doc;
  void _s;
  return rest;
}

export async function GET(req: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");
    const teamId = searchParams.get("teamId");
    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId required" },
        { status: 400 },
      );
    }
    if (teamId) {
      const forTeam = await FinalPuzzle.findOne({ sessionId, teamId }).lean();
      if (forTeam) {
        return NextResponse.json(withoutHash(forTeam));
      }
    }
    const global = await FinalPuzzle.findOne({ sessionId, teamId: null }).lean();
    if (!global) {
      return NextResponse.json(null);
    }
    return NextResponse.json(withoutHash(global));
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await dbConnect();
    const body = await req.json();
    const sessionId = String(body.sessionId ?? "");
    if (!mongoose.isValidObjectId(sessionId)) {
      return NextResponse.json({ error: "Invalid sessionId" }, { status: 400 });
    }
    const plain = String(body.solutionPlain ?? "");
    if (!plain) {
      return NextResponse.json(
        { error: "solutionPlain required to set puzzle" },
        { status: 400 },
      );
    }
    const validatorType = body.validatorType ?? "normalized";
    const validatorConfig = (body.validatorConfig ?? {}) as Record<
      string,
      unknown
    >;
    const solutionHash = hashPlainForValidator(
      validatorType,
      plain,
      validatorConfig,
    );
    const teamId =
      body.teamId && mongoose.isValidObjectId(String(body.teamId))
        ? String(body.teamId)
        : null;
    const filter = teamId ? { sessionId, teamId } : { sessionId, teamId: null };

    const doc = await FinalPuzzle.findOneAndUpdate(
      filter,
      {
        $set: {
          sessionId,
          teamId,
          validatorType,
          validatorConfig,
          solutionHash,
        },
      },
      { upsert: true, new: true },
    );
    return NextResponse.json(withoutHash(doc.toObject()));
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
