import { dbConnect } from "@/lib/db/connect";
import { GameDefinition } from "@/lib/db/models";
import { CAMP_GAMES, scoringForSeed } from "@/lib/seed/camp-games";

/**
 * Upserts a single game from CAMP_GAMES when missing (e.g. DB never seeded).
 * Returns true if a matching seed entry existed and was written.
 */
export async function ensureGameDefinitionBySlug(slug: string): Promise<boolean> {
  const g = CAMP_GAMES.find((x) => x.slug === slug);
  if (!g) return false;
  await dbConnect();
  const scoring = scoringForSeed(g);
  const $set: Record<string, unknown> = {
    name: g.name,
    slug: g.slug,
    day: g.day,
    category: g.category,
    engineKey: g.engineKey,
    isPlayable: g.isPlayable,
    order: g.order,
    scoring,
    rulesMarkdown: g.rulesMarkdown ?? "",
  };
  const update: Record<string, unknown> = { $set };
  if (g.settings !== undefined) {
    update.$setOnInsert = { settings: g.settings };
  }
  await GameDefinition.findOneAndUpdate({ slug: g.slug }, update, {
    upsert: true,
    new: true,
    setDefaultsOnInsert: true,
  });
  return true;
}
