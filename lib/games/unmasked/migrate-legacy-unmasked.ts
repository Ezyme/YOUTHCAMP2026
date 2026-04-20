import mongoose from "mongoose";
import { UnmaskedState } from "@/lib/db/models";

/** Patch legacy saves (single verse, missing verseKey on fragments). */
export async function migrateLegacyUnmaskedState(
  doc: Record<string, unknown> & { _id: mongoose.Types.ObjectId },
): Promise<void> {
  const verseKey = doc.verseKey as string | undefined;
  const verseKeys = (doc.verseKeys as string[] | undefined) ?? [];
  const frags =
    (doc.verseFragments as { index: number; text: string; order: number; verseKey?: string }[]) ?? [];
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
