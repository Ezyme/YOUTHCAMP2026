import { notFound } from "next/navigation";
import { plainGameScoring } from "@/lib/admin/plain-game-scoring";
import { dbConnect } from "@/lib/db/connect";
import { GameDefinition } from "@/lib/db/models";
import { GameForm } from "@/components/admin/game-form";
import mongoose from "mongoose";

type Props = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export default async function EditGamePage({ params }: Props) {
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) notFound();
  await dbConnect();
  const g = await GameDefinition.findById(id).lean();
  if (!g) notFound();

  const initial = {
    _id: String(g._id),
    name: g.name,
    slug: g.slug,
    day: g.day,
    category: g.category,
    engineKey: g.engineKey,
    isPlayable: g.isPlayable,
    order: g.order,
    rulesMarkdown: g.rulesMarkdown,
    settings: g.settings as Record<string, unknown>,
    scoring: plainGameScoring(g.scoring),
  };

  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground">Edit game</h1>
      <div className="mt-6">
        <GameForm initial={initial} />
      </div>
    </div>
  );
}
