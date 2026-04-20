import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db/connect";
import { GameDefinition, GameResult, Team } from "@/lib/db/models";
import {
  clampManualPoints,
  pointsForPlacement,
  validateManualPointsSet,
  validatePlacementSet,
} from "@/lib/scoring/points";
import mongoose from "mongoose";

export async function GET(req: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");
    const gameId = searchParams.get("gameId");
    if (!sessionId || !gameId) {
      return NextResponse.json(
        { error: "sessionId and gameId required" },
        { status: 400 },
      );
    }
    const results = await GameResult.find({ sessionId, gameId }).lean();
    return NextResponse.json(results);
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
    const gameId = String(body.gameId ?? "");
    if (
      !mongoose.isValidObjectId(sessionId) ||
      !mongoose.isValidObjectId(gameId)
    ) {
      return NextResponse.json({ error: "Invalid ids" }, { status: 400 });
    }

    const game = await GameDefinition.findById(gameId);
    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    const sid = new mongoose.Types.ObjectId(sessionId);
    const gid = new mongoose.Types.ObjectId(gameId);
    const mode = game.scoring.scoringMode ?? "placement_points";
    const maxPl = game.scoring.maxPlacements ?? 6;

    if (mode === "manual_points") {
      const maxPts = game.scoring.manualPointsMax ?? 10;
      const raw = (body.results ?? []) as {
        teamId: string;
        points: number;
        notes?: string;
        updateReason?: string;
      }[];
      const teamDocs = await Team.find({ sessionId: sid })
        .sort({ sortOrder: 1, name: 1 })
        .lean();
      const prepared = raw.map((e) => ({
        teamId: e.teamId,
        points: clampManualPoints(Number(e.points), maxPts),
        notes: e.notes,
        updateReason: e.updateReason,
      }));
      const v = validateManualPointsSet(prepared, teamDocs.length, maxPts);
      if (!v.ok) {
        return NextResponse.json({ error: v.error }, { status: 400 });
      }

      const orderIdx = new Map(
        teamDocs.map((t, i) => [String(t._id), t.sortOrder ?? i] as const),
      );
      const ranked = [...prepared].sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        return (
          (orderIdx.get(a.teamId) ?? 0) - (orderIdx.get(b.teamId) ?? 0)
        );
      });
      const placementByTeam = new Map<string, number>();
      ranked.forEach((e, i) => {
        placementByTeam.set(e.teamId, i + 1);
      });

      const ops = prepared.map((e) => {
        const pointsAwarded = e.points;
        const placement = placementByTeam.get(e.teamId) ?? 1;
        const tid = new mongoose.Types.ObjectId(e.teamId);
        return {
          updateOne: {
            filter: { sessionId: sid, gameId: gid, teamId: tid },
            update: {
              $set: {
                placement,
                pointsAwarded,
                notes: e.notes,
                updateReason: e.updateReason,
              },
              $setOnInsert: {
                sessionId: sid,
                gameId: gid,
                teamId: tid,
              },
            },
            upsert: true,
          },
        };
      });

      await GameResult.bulkWrite(ops);
      const saved = await GameResult.find({ sessionId, gameId }).lean();
      return NextResponse.json(saved);
    }

    const entries = (body.results ?? []) as {
      teamId: string;
      placement: number;
      completedAt?: string;
      notes?: string;
      updateReason?: string;
    }[];

    const v = validatePlacementSet(
      entries.map((e) => ({
        teamId: e.teamId,
        placement: Number(e.placement),
      })),
      maxPl,
    );
    if (!v.ok) {
      return NextResponse.json({ error: v.error }, { status: 400 });
    }

    const ops = entries.map((e) => {
      const placement = Number(e.placement);
      const pointsAwarded = pointsForPlacement(game.scoring, placement);
      const tid = new mongoose.Types.ObjectId(e.teamId);
      return {
        updateOne: {
          filter: { sessionId: sid, gameId: gid, teamId: tid },
          update: {
            $set: {
              placement,
              pointsAwarded,
              notes: e.notes,
              updateReason: e.updateReason,
              completedAt: e.completedAt ? new Date(e.completedAt) : undefined,
            },
            $setOnInsert: {
              sessionId: sid,
              gameId: gid,
              teamId: tid,
            },
          },
          upsert: true,
        },
      };
    });

    await GameResult.bulkWrite(ops);
    const saved = await GameResult.find({ sessionId, gameId }).lean();
    return NextResponse.json(saved);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
