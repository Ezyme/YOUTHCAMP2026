import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db/connect";
import { PowerUpCode, Session, Team, UnmaskedState } from "@/lib/db/models";
import mongoose from "mongoose";

export async function GET(req: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");
    if (!sessionId || !mongoose.isValidObjectId(sessionId)) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    }
    const codes = await PowerUpCode.find({ sessionId }).sort({ createdAt: 1 }).lean();

    const teamIds = [
      ...new Set(codes.flatMap((c) => [
        ...(c.teamId ? [String(c.teamId)] : []),
        ...c.redeemedBy.map(String),
      ])),
    ].filter(mongoose.isValidObjectId);

    const teams = teamIds.length
      ? await Team.find({ _id: { $in: teamIds } }).select("name").lean()
      : [];
    const teamMap = new Map(teams.map((t) => [String(t._id), t.name]));

    const enriched = await Promise.all(
      codes.map(async (c) => {
        const validRedeemedBy = c.redeemedBy.filter((id) =>
          teamMap.has(String(id)),
        );
        if (validRedeemedBy.length !== c.redeemedBy.length) {
          await PowerUpCode.updateOne(
            { _id: c._id },
            { $set: { redeemedBy: validRedeemedBy } },
          );
        }
        const redeemedByNames = validRedeemedBy.map(
          (id) => teamMap.get(String(id))!,
        );
        return {
          ...c,
          redeemedBy: validRedeemedBy,
          teamName: c.teamId ? teamMap.get(String(c.teamId)) ?? null : null,
          redeemedByNames,
        };
      }),
    );

    return NextResponse.json(enriched);
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

    const code = String(body.code ?? "").trim().toUpperCase();
    if (!code) {
      return NextResponse.json({ error: "Code required" }, { status: 400 });
    }

    const session = await Session.findById(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const doc = await PowerUpCode.create({
      sessionId,
      code,
      powerUpType: body.powerUpType ?? "extra_heart",
      scope: body.scope ?? "universal",
      teamId: body.teamId && mongoose.isValidObjectId(body.teamId) ? body.teamId : null,
      redeemedBy: [],
    });

    return NextResponse.json(doc);
  } catch (e) {
    if ((e as { code?: number }).code === 11000) {
      return NextResponse.json({ error: "Code already exists for this session" }, { status: 400 });
    }
    const message = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    await dbConnect();
    const body = await req.json().catch(() => ({}));
    const id = String(body.id ?? "");
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    const codeDoc = await PowerUpCode.findById(id).lean();
    if (!codeDoc) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const bodySessionId = body.sessionId != null ? String(body.sessionId) : "";
    if (bodySessionId && String(codeDoc.sessionId) !== bodySessionId) {
      return NextResponse.json({ error: "Session mismatch" }, { status: 403 });
    }

    const oldCodeUpper = String(codeDoc.code).trim().toUpperCase();
    const $set: Record<string, unknown> = {};

    if (Object.hasOwn(body, "code")) {
      const c = String(body.code ?? "").trim().toUpperCase();
      if (!c) {
        return NextResponse.json({ error: "code cannot be empty" }, { status: 400 });
      }
      $set.code = c;
    }
    if (Object.hasOwn(body, "powerUpType")) {
      $set.powerUpType = body.powerUpType;
    }
    if (Object.hasOwn(body, "scope")) {
      const s = body.scope;
      if (s !== "universal" && s !== "per_team") {
        return NextResponse.json({ error: "Invalid scope" }, { status: 400 });
      }
      $set.scope = s;
    }
    if (Object.hasOwn(body, "teamId")) {
      if (body.teamId === null || body.teamId === "") {
        $set.teamId = null;
      } else if (mongoose.isValidObjectId(String(body.teamId))) {
        $set.teamId = body.teamId;
      } else {
        return NextResponse.json({ error: "Invalid teamId" }, { status: 400 });
      }
    }

    const nextScope =
      ($set.scope as string | undefined) ?? (codeDoc.scope as string);
    if (nextScope === "universal") {
      $set.teamId = null;
    } else if (nextScope === "per_team") {
      const tid = $set.teamId ?? codeDoc.teamId;
      if (!tid) {
        return NextResponse.json(
          { error: "Per-team codes require a team — set teamId" },
          { status: 400 },
        );
      }
      $set.teamId = tid;
    }

    if (Object.keys($set).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const newCodeUpper =
      $set.code != null ? String($set.code).trim().toUpperCase() : oldCodeUpper;

    const updated = await PowerUpCode.findOneAndUpdate({ _id: id }, { $set }, { new: true }).lean();
    if (!updated) {
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }

    if ($set.code != null && oldCodeUpper !== newCodeUpper) {
      await UnmaskedState.updateMany(
        { sessionId: codeDoc.sessionId, redeemedCodes: oldCodeUpper },
        [
          {
            $set: {
              redeemedCodes: {
                $map: {
                  input: "$redeemedCodes",
                  as: "r",
                  in: {
                    $cond: [{ $eq: ["$$r", oldCodeUpper] }, newCodeUpper, "$$r"],
                  },
                },
              },
            },
          },
        ],
      );
    }

    return NextResponse.json(updated);
  } catch (e) {
    if ((e as { code?: number }).code === 11000) {
      return NextResponse.json(
        { error: "That code already exists for this session" },
        { status: 400 },
      );
    }
    const message = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id || !mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    await PowerUpCode.deleteOne({ _id: id });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
