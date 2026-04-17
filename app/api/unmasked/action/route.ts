import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { CAMP_AUTH_COOKIE, isCampGateEnabled } from "@/lib/camp/auth";
import { dbConnect } from "@/lib/db/connect";
import { GameDefinition, UnmaskedState, type PowerUpType } from "@/lib/db/models";
import {
  generateBoard,
  revealTile,
  toggleFlag,
  applyPowerUp,
  devRevealAllSafeTiles,
  sortPersistedFragmentsForBoard,
  trySolveVerseAssembly,
  MAX_VERSE_ASSEMBLY_ATTEMPTS,
  type GameState,
} from "@/lib/games/unmasked/engine";
import { getVerseByKey } from "@/lib/games/unmasked/verses";
import mongoose from "mongoose";

async function requireAuth(): Promise<boolean> {
  if (!isCampGateEnabled()) return true;
  const jar = await cookies();
  return jar.get(CAMP_AUTH_COOKIE)?.value === "1";
}

function rebuildGameState(doc: Record<string, unknown>): GameState {
  const seed = Number(doc.seed);
  const gridSize = Number(doc.gridSize);
  const totalLies = Number(doc.totalLies);
  const legacyKey = String(doc.verseKey ?? "");
  const rawFrags =
    (doc.verseFragments as { index: number; text: string; order: number; verseKey?: string }[]) ??
    [];
  const frags = rawFrags.map((f) => ({
    index: f.index,
    text: f.text,
    order: f.order,
    verseKey: f.verseKey ?? legacyKey,
  }));
  const sorted = sortPersistedFragmentsForBoard(seed, gridSize, totalLies, frags);
  const board = generateBoard(seed, gridSize, totalLies, sorted);

  return {
    board,
    revealed: new Set((doc.revealed as number[]) ?? []),
    flagged: new Set((doc.flagged as number[]) ?? []),
    hearts: Number(doc.hearts ?? 3),
    maxHearts: Number(doc.maxHearts ?? 3),
    liesHit: Number(doc.liesHit ?? 0),
    shielded: Boolean(doc.shielded),
    powerUps: ((doc.powerUps as { type: PowerUpType; used: boolean }[]) ?? []).map((p) => ({
      type: p.type,
      used: p.used,
    })),
    status: (doc.status as "playing" | "won" | "lost") ?? "playing",
  };
}

export async function POST(req: Request) {
  try {
    if (!(await requireAuth())) {
      return NextResponse.json({ error: "Login required" }, { status: 401 });
    }
    await dbConnect();
    const body = await req.json();
    const sessionId = body.sessionId;
    const teamId = body.teamId;
    const action = String(body.action);
    const index = body.index != null ? Number(body.index) : undefined;
    const axis =
      body.axis === "row" || body.axis === "col" ? (body.axis as "row" | "col") : undefined;
    const powerUpType = body.powerUpType as PowerUpType | undefined;

    if (
      !sessionId ||
      !teamId ||
      !mongoose.isValidObjectId(sessionId) ||
      !mongoose.isValidObjectId(teamId)
    ) {
      return NextResponse.json({ error: "Invalid ids" }, { status: 400 });
    }

    const sid = new mongoose.Types.ObjectId(sessionId);
    const tid = new mongoose.Types.ObjectId(teamId);

    const doc = await UnmaskedState.findOne({
      sessionId: sid,
      teamId: tid,
    }).lean();

    if (!doc) {
      return NextResponse.json({ error: "No game state found" }, { status: 404 });
    }

    const d = doc as unknown as Record<string, unknown>;

    if (action === "check_verse") {
      const assembly = (body.assemblyIndices as number[]) ?? [];
      const legacyKey = String(d.verseKey ?? "");
      const rawFrags =
        (d.verseFragments as { index: number; order: number; verseKey?: string }[]) ?? [];
      const frags = rawFrags.map((f) => ({
        index: f.index,
        order: f.order,
        verseKey: f.verseKey ?? legacyKey,
      }));
      const restored = (d.versesRestored as string[]) ?? [];
      const versesGivenUp = (d.versesGivenUp as string[]) ?? [];
      const attemptsByKey = {
        ...((d.verseCheckAttemptsByKey as Record<string, number> | undefined) ?? {}),
      };

      const baseState = () => ({
        revealed: d.revealed,
        flagged: d.flagged,
        hearts: d.hearts,
        maxHearts: d.maxHearts,
        liesHit: d.liesHit,
        shielded: d.shielded,
        powerUps: d.powerUps,
        status: d.status,
        versesRestored: restored,
        versesGivenUp,
        verseCheckAttemptsByKey: attemptsByKey,
        verseScore: Number(d.verseScore ?? 0),
        verseAssemblyIndices: assembly,
      });

      if (d.status !== "won") {
        return NextResponse.json({
          result: {
            type: "verse_check",
            ok: false,
            reason:
              "Clear the minefield first (all safe tiles revealed). Then you can assemble passages.",
          },
          state: baseState(),
        });
      }

      if (assembly.length === 0) {
        return NextResponse.json({
          result: { type: "verse_check", ok: false, reason: "Add fragments to the builder row first." },
          state: baseState(),
        });
      }

      const byIndex = new Map(frags.map((f) => [f.index, f]));
      const metas = assembly.map((i) => byIndex.get(i));
      if (metas.some((m) => !m)) {
        return NextResponse.json({
          result: { type: "verse_check", ok: false, reason: "Invalid fragment selection." },
          state: baseState(),
        });
      }

      const attemptKey = metas[0]!.verseKey;
      const givenUpSet = new Set(versesGivenUp);
      if (givenUpSet.has(attemptKey)) {
        return NextResponse.json({
          result: {
            type: "verse_check",
            ok: false,
            reason: "No check attempts left for this passage — the answer was already shown.",
          },
          state: baseState(),
        });
      }

      const solved = new Set(restored);
      const verdict = trySolveVerseAssembly(assembly, frags, solved);

      if (verdict.ok) {
        const nextRestored = [...restored, verdict.verseKey];
        const verseScore = Number(d.verseScore ?? 0) + verdict.pointsAdded;
        const nextAttempts = { ...attemptsByKey };
        delete nextAttempts[verdict.verseKey];

        await UnmaskedState.updateOne(
          { sessionId: sid, teamId: tid },
          {
            $set: {
              versesRestored: nextRestored,
              verseScore,
              verseAssemblyIndices: [],
              verseCheckAttemptsByKey: nextAttempts,
              versesGivenUp,
            },
          },
        );

        return NextResponse.json({
          result: {
            type: "verse_check",
            ok: true,
            verseKey: verdict.verseKey,
            pointsAdded: verdict.pointsAdded,
            verseScore,
          },
          state: {
            revealed: d.revealed,
            flagged: d.flagged,
            hearts: d.hearts,
            maxHearts: d.maxHearts,
            liesHit: d.liesHit,
            shielded: d.shielded,
            powerUps: d.powerUps,
            status: d.status,
            versesRestored: nextRestored,
            versesGivenUp,
            verseCheckAttemptsByKey: nextAttempts,
            verseScore,
            verseAssemblyIndices: [],
          },
        });
      }

      const nextCount = (attemptsByKey[attemptKey] ?? 0) + 1;
      attemptsByKey[attemptKey] = nextCount;

      if (nextCount >= MAX_VERSE_ASSEMBLY_ATTEMPTS) {
        const nextGivenUp = versesGivenUp.includes(attemptKey) ? versesGivenUp : [...versesGivenUp, attemptKey];

        await UnmaskedState.updateOne(
          { sessionId: sid, teamId: tid },
          {
            $set: {
              verseCheckAttemptsByKey: attemptsByKey,
              versesGivenUp: nextGivenUp,
              verseAssemblyIndices: [],
            },
          },
        );

        const entry = getVerseByKey(attemptKey);
        return NextResponse.json({
          result: {
            type: "verse_check",
            ok: false,
            forfeited: true,
            verseKey: attemptKey,
            reason: verdict.reason,
            reference: entry?.reference ?? "",
            full: entry?.full ?? "",
          },
          state: {
            revealed: d.revealed,
            flagged: d.flagged,
            hearts: d.hearts,
            maxHearts: d.maxHearts,
            liesHit: d.liesHit,
            shielded: d.shielded,
            powerUps: d.powerUps,
            status: d.status,
            versesRestored: restored,
            versesGivenUp: nextGivenUp,
            verseCheckAttemptsByKey: attemptsByKey,
            verseScore: Number(d.verseScore ?? 0),
            verseAssemblyIndices: [],
          },
        });
      }

      await UnmaskedState.updateOne(
        { sessionId: sid, teamId: tid },
        {
          $set: {
            verseCheckAttemptsByKey: attemptsByKey,
            verseAssemblyIndices: assembly,
          },
        },
      );

      const attemptsRemaining = MAX_VERSE_ASSEMBLY_ATTEMPTS - nextCount;
      return NextResponse.json({
        result: {
          type: "verse_check",
          ok: false,
          reason: verdict.reason,
          attemptsRemaining,
        },
        state: {
          revealed: d.revealed,
          flagged: d.flagged,
          hearts: d.hearts,
          maxHearts: d.maxHearts,
          liesHit: d.liesHit,
          shielded: d.shielded,
          powerUps: d.powerUps,
          status: d.status,
          versesRestored: restored,
          versesGivenUp,
          verseCheckAttemptsByKey: attemptsByKey,
          verseScore: Number(d.verseScore ?? 0),
          verseAssemblyIndices: assembly,
        },
      });
    }

    const state = rebuildGameState(d);

    let result: unknown = null;

    if (action === "dev_reveal_all_safe") {
      if (process.env.NODE_ENV !== "development") {
        return NextResponse.json({ error: "Not available outside development" }, { status: 403 });
      }
      devRevealAllSafeTiles(state);
      result = { type: "dev_reveal_all_safe", revealedCount: state.revealed.size };
    } else switch (action) {
      case "reveal": {
        if (index == null) {
          return NextResponse.json({ error: "index required" }, { status: 400 });
        }
        result = revealTile(state, index);
        break;
      }
      case "flag": {
        if (index == null) {
          return NextResponse.json({ error: "index required" }, { status: 400 });
        }
        toggleFlag(state, index);
        result = { flagged: state.flagged.has(index) };
        break;
      }
      case "use_powerup": {
        if (!powerUpType) {
          return NextResponse.json({ error: "powerUpType required" }, { status: 400 });
        }
        const gameSlug = String(body.gameSlug ?? "unmasked");
        const game = await GameDefinition.findOne({ slug: gameSlug }).lean();
        const settings = (game?.settings ?? {}) as Record<string, unknown>;
        const safeOpeningMinTiles = Math.max(0, Math.floor(Number(settings.safeOpeningMinTiles ?? 0)));
        const rawScout = body.index;
        const scoutTargetIndex =
          powerUpType === "scout" && rawScout != null && rawScout !== ""
            ? Number(rawScout)
            : undefined;
        result = applyPowerUp(state, powerUpType, Date.now(), {
          safeOpeningMinTiles,
          scoutTargetIndex:
            scoutTargetIndex !== undefined && Number.isInteger(scoutTargetIndex) ?
              scoutTargetIndex
            : undefined,
          truthRadarTargetIndex:
            powerUpType === "truth_radar" && index !== undefined && Number.isInteger(index) ? index : undefined,
          truthRadarAxis: powerUpType === "truth_radar" ? axis : undefined,
          verseCompassAnchorIndex:
            powerUpType === "verse_compass" && index !== undefined && Number.isInteger(index) ? index : undefined,
          liePinAnchorIndex:
            powerUpType === "lie_pin" && index !== undefined && Number.isInteger(index) ? index : undefined,
          gentleStepAnchorIndex:
            powerUpType === "gentle_step" && index !== undefined && Number.isInteger(index) ? index : undefined,
        });
        break;
      }
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    const finishedAt =
      state.status !== "playing" && !doc.finishedAt ? new Date() : doc.finishedAt;

    await UnmaskedState.updateOne(
      { sessionId: sid, teamId: tid },
      {
        $set: {
          revealed: [...state.revealed],
          flagged: [...state.flagged],
          hearts: state.hearts,
          maxHearts: state.maxHearts,
          liesHit: state.liesHit,
          shielded: state.shielded,
          powerUps: state.powerUps,
          status: state.status,
          finishedAt,
        },
      },
    );

    return NextResponse.json({
      result,
      state: {
        revealed: [...state.revealed],
        flagged: [...state.flagged],
        hearts: state.hearts,
        maxHearts: state.maxHearts,
        liesHit: state.liesHit,
        shielded: state.shielded,
        powerUps: state.powerUps,
        status: state.status,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
