import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { CAMP_AUTH_COOKIE, isCampGateEnabled } from "@/lib/camp/auth";
import { dbConnect } from "@/lib/db/connect";
import {
  GameDefinition,
  PowerUpCode,
  UnmaskedState,
  type PowerUpType,
} from "@/lib/db/models";
import { powerUpEntriesForRedemption } from "@/lib/games/unmasked/redeem-grants";
import { planUnmaskedLayout } from "@/lib/games/unmasked/plan-layout";
import mongoose from "mongoose";

async function requireAuth(): Promise<boolean> {
  if (!isCampGateEnabled()) return true;
  const jar = await cookies();
  return jar.get(CAMP_AUTH_COOKIE)?.value === "1";
}

function parseOid(id: string | null | undefined): mongoose.Types.ObjectId | null {
  if (!id || !mongoose.isValidObjectId(id)) return null;
  return new mongoose.Types.ObjectId(id);
}

/**
 * Builds a Mongo `$set` from the request body. **Only keys actually sent** are applied.
 * Partial client updates (e.g. verse assembly debounce) must not default missing fields to
 * empty arrays or they wipe board progress, redeemed codes, and power-ups.
 */
type UnmaskedPartialUpdateResult = {
  $set: Record<string, unknown>;
  $unset?: Record<string, 1>;
};

function buildUnmaskedPartialUpdate(body: Record<string, unknown>): UnmaskedPartialUpdateResult {
  const $set: Record<string, unknown> = {};
  const $unset: Record<string, 1> = {};

  const copyIfPresent = (key: string) => {
    if (Object.hasOwn(body, key)) $set[key] = body[key];
  };

  copyIfPresent("seed");
  copyIfPresent("gridSize");
  copyIfPresent("totalLies");
  copyIfPresent("revealed");
  copyIfPresent("flagged");
  copyIfPresent("hearts");
  copyIfPresent("maxHearts");
  copyIfPresent("verseKeys");
  copyIfPresent("verseFragments");
  if (Object.hasOwn(body, "verseAssemblyIndices") || Object.hasOwn(body, "verseAssembly")) {
    $set.verseAssemblyIndices =
      (body.verseAssemblyIndices as number[] | undefined) ??
      (body.verseAssembly as number[] | undefined) ??
      [];
  }
  copyIfPresent("versesRestored");
  copyIfPresent("verseCheckAttemptsByKey");
  copyIfPresent("versesGivenUp");
  copyIfPresent("verseScore");
  copyIfPresent("redeemedCodes");
  copyIfPresent("powerUps");
  copyIfPresent("shielded");
  copyIfPresent("status");
  copyIfPresent("liesHit");
  copyIfPresent("finalScore");
  copyIfPresent("scoreBreakdown");

  if (Object.hasOwn(body, "startedAt") && body.startedAt != null) {
    $set.startedAt = new Date(String(body.startedAt));
  }
  if (Object.hasOwn(body, "submittedAt")) {
    if (body.submittedAt == null || body.submittedAt === "") $unset.submittedAt = 1;
    else $set.submittedAt = new Date(String(body.submittedAt));
  }
  if (Object.hasOwn(body, "finishedAt")) {
    if (body.finishedAt == null || body.finishedAt === "") $unset.finishedAt = 1;
    else $set.finishedAt = new Date(String(body.finishedAt));
  }

  const hasSet = Object.keys($set).length > 0;
  const hasUnset = Object.keys($unset).length > 0;
  if (!hasSet && !hasUnset) {
    return { $set: {} };
  }
  return hasUnset ? { $set, $unset } : { $set };
}

/** Patch legacy saves (single verse, missing verseKey on fragments). */
async function migrateLegacyUnmaskedState(
  doc: Record<string, unknown> & { _id: mongoose.Types.ObjectId },
): Promise<void> {
  const verseKey = doc.verseKey as string | undefined;
  const verseKeys = (doc.verseKeys as string[] | undefined) ?? [];
  const frags = (doc.verseFragments as { index: number; text: string; order: number; verseKey?: string }[]) ?? [];
  const needsKeys = verseKeys.length === 0 && verseKey;
  const needsFragKey = frags.some((f) => !f.verseKey);
  const needsAssemblyField =
    !(doc.verseAssemblyIndices as number[] | undefined)?.length &&
    (doc.verseAssembly as number[] | undefined)?.length;
  const needsRestored =
    !(doc.versesRestored as string[] | undefined)?.length && doc.verseCompleted && verseKey;

  if (!needsKeys && !needsFragKey && !needsAssemblyField && !needsRestored) return;

  let keys = verseKeys.length > 0 ? verseKeys : verseKey ? [verseKey] : [];
  const patchedFrags = frags.map((f) => ({
    index: f.index,
    text: f.text,
    order: f.order,
    verseKey: f.verseKey ?? keys[0] ?? "unknown",
  }));
  if (keys.length === 0 && patchedFrags.length > 0) {
    keys = [...new Set(patchedFrags.map((f) => f.verseKey))];
  }
  const assembly =
    (doc.verseAssemblyIndices as number[] | undefined)?.length ?
      (doc.verseAssemblyIndices as number[])
    : (doc.verseAssembly as number[]) ?? [];
  let restored = (doc.versesRestored as string[] | undefined) ?? [];
  if (!restored.length && doc.verseCompleted && verseKey) {
    restored = [verseKey];
  }
  let score = Number(doc.verseScore ?? 0);
  if (score === 0 && doc.verseCompleted && verseKey) {
    score = patchedFrags.filter((f) => f.verseKey === verseKey).length;
  }

  await UnmaskedState.updateOne(
    { _id: doc._id },
    {
      $set: {
        verseKeys: keys,
        verseFragments: patchedFrags,
        verseAssemblyIndices: assembly,
        versesRestored: restored,
        verseScore: score,
      },
    },
  );
}

export async function GET(req: Request) {
  try {
    if (!(await requireAuth())) {
      return NextResponse.json({ error: "Login required" }, { status: 401 });
    }
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const sessionId = parseOid(searchParams.get("sessionId"));
    const teamId = parseOid(searchParams.get("teamId"));
    const slug = searchParams.get("slug") ?? "unmasked";
    if (!sessionId || !teamId) {
      return NextResponse.json({ error: "sessionId and teamId required" }, { status: 400 });
    }

    let state = await UnmaskedState.findOne({ sessionId, teamId }).lean();
    if (state) {
      await migrateLegacyUnmaskedState(
        state as unknown as Record<string, unknown> & { _id: mongoose.Types.ObjectId },
      );
      state = await UnmaskedState.findOne({ sessionId, teamId }).lean();
      return NextResponse.json(state);
    }

    const game = await GameDefinition.findOne({ slug }).lean();
    const settings = (game?.settings ?? {}) as Record<string, unknown>;
    const baseSeed = Number(settings.seed ?? Math.floor(Math.random() * 1_000_000));
    const layout = planUnmaskedLayout(settings, baseSeed);

    state = await UnmaskedState.findOneAndUpdate(
      { sessionId, teamId },
      {
        $setOnInsert: {
          sessionId,
          teamId,
          seed: layout.seed,
          gridSize: layout.gridSize,
          totalLies: layout.totalLies,
          revealed: [],
          flagged: [],
          hearts: 3,
          maxHearts: 3,
          verseKeys: layout.verseKeys,
          verseFragments: layout.verseFragments,
          verseAssemblyIndices: [],
          versesRestored: [],
          verseCheckAttemptsByKey: {},
          versesGivenUp: [],
          verseScore: 0,
          redeemedCodes: [],
          powerUps: [],
          shielded: false,
          status: "playing",
          liesHit: 0,
          startedAt: new Date(),
        },
      },
      { upsert: true, new: true },
    ).lean();

    return NextResponse.json(state);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    if (!(await requireAuth())) {
      return NextResponse.json({ error: "Login required" }, { status: 401 });
    }
    await dbConnect();
    const body = await req.json();
    const sessionId = parseOid(body.sessionId);
    const teamId = parseOid(body.teamId);
    if (!sessionId || !teamId) {
      return NextResponse.json({ error: "sessionId and teamId required" }, { status: 400 });
    }

    if (body.reset === true) {
      const slug = String(body.slug ?? "unmasked");
      const existing = await UnmaskedState.findOne({ sessionId, teamId }).lean();
      if (!existing) {
        return NextResponse.json({ error: "No game to reset — open the game once first" }, { status: 404 });
      }

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
            // Auto-apply: 1 charge = +1 max heart (and +1 current). Mark entries used.
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
            startedAt: new Date(),
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

      return NextResponse.json(doc);
    }

    const partial = buildUnmaskedPartialUpdate(body as Record<string, unknown>);
    const hasSet = Object.keys(partial.$set).length > 0;
    const hasUnset = partial.$unset && Object.keys(partial.$unset).length > 0;
    if (!hasSet && !hasUnset) {
      return NextResponse.json({ error: "No state fields to update" }, { status: 400 });
    }

    const updateDoc: Record<string, unknown> = {};
    if (hasSet) updateDoc.$set = partial.$set;
    if (hasUnset && partial.$unset) updateDoc.$unset = partial.$unset;

    const doc = await UnmaskedState.findOneAndUpdate({ sessionId, teamId }, updateDoc, {
      new: true,
    }).lean();

    if (!doc) {
      return NextResponse.json({ error: "State not found" }, { status: 404 });
    }
    return NextResponse.json(doc);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
