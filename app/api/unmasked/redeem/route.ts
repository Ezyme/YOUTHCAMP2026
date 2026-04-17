import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { CAMP_AUTH_COOKIE, isCampGateEnabled } from "@/lib/camp/auth";
import { dbConnect } from "@/lib/db/connect";
import { PowerUpCode, UnmaskedState, type PowerUpType } from "@/lib/db/models";
import {
  chargesFor,
  powerUpEntriesForRedemption,
} from "@/lib/games/unmasked/redeem-grants";
import mongoose from "mongoose";

/** Power-ups that apply automatically at redemption (no arming step). */
const AUTO_APPLY: ReadonlySet<PowerUpType> = new Set(["extra_heart", "shield"]);

/** Build redemption entries; auto-applied types are marked used=true. */
function buildEntries(type: PowerUpType): { type: PowerUpType; used: boolean }[] {
  const base = powerUpEntriesForRedemption(type);
  if (!AUTO_APPLY.has(type)) return base;
  return base.map((e) => ({ ...e, used: true }));
}

/** Update for auto-applied side effects (hearts++, shield on). */
function autoApplyUpdate(
  type: PowerUpType,
  count: number,
): Record<string, unknown> | null {
  if (type === "extra_heart") {
    return { $inc: { maxHearts: count, hearts: count } };
  }
  if (type === "shield") {
    return { $set: { shielded: true } };
  }
  return null;
}

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
    const code = String(body.code ?? "").trim().toUpperCase();

    if (
      !mongoose.isValidObjectId(sessionId) ||
      !mongoose.isValidObjectId(teamId) ||
      !code
    ) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const sid = new mongoose.Types.ObjectId(sessionId);
    const tid = new mongoose.Types.ObjectId(teamId);

    const codeDoc = await PowerUpCode.findOne({ sessionId: sid, code });
    if (!codeDoc) {
      return NextResponse.json({ error: "Invalid code" }, { status: 404 });
    }

    if (codeDoc.scope === "per_team" && codeDoc.teamId && !codeDoc.teamId.equals(tid)) {
      return NextResponse.json({ error: "This code is not for your team" }, { status: 403 });
    }

    const alreadyUsed = codeDoc.redeemedBy.some((id) => id.equals(tid));

    const type = codeDoc.powerUpType as PowerUpType;
    const entries = buildEntries(type);
    const auto = autoApplyUpdate(type, chargesFor(type));
    const applied = AUTO_APPLY.has(type);

    if (alreadyUsed) {
      // Repair: first attempt may have added this team to `redeemedBy` on PowerUpCode but failed
      // to update UnmaskedState (e.g. bad `powerUps` schema / CastError). Grant the reward once.
      const state = await UnmaskedState.findOne({ sessionId: sid, teamId: tid }).lean();
      const redeemedCodes = (state?.redeemedCodes as string[] | undefined) ?? [];
      if (!redeemedCodes.includes(code)) {
        const update: Record<string, unknown> = {
          $addToSet: { redeemedCodes: code },
          $push: { powerUps: { $each: entries } },
        };
        if (auto) {
          Object.assign(update, auto);
        }
        await UnmaskedState.updateOne({ sessionId: sid, teamId: tid }, update);
        return NextResponse.json({
          ok: true,
          powerUpType: type,
          applied,
          repaired: true,
        });
      }
      return NextResponse.json({ error: "Code already redeemed" }, { status: 400 });
    }

    await PowerUpCode.updateOne(
      { _id: codeDoc._id },
      { $addToSet: { redeemedBy: tid } },
    );

    try {
      const update: Record<string, unknown> = {
        $addToSet: { redeemedCodes: code },
        $push: { powerUps: { $each: entries } },
      };
      if (auto) {
        Object.assign(update, auto);
      }
      await UnmaskedState.updateOne({ sessionId: sid, teamId: tid }, update);
    } catch (e) {
      await PowerUpCode.updateOne({ _id: codeDoc._id }, { $pull: { redeemedBy: tid } });
      throw e;
    }

    return NextResponse.json({
      ok: true,
      powerUpType: type,
      applied,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
