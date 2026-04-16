import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db/connect";
import { GameDefinition } from "@/lib/db/models";

export async function GET() {
  try {
    await dbConnect();
    const games = await GameDefinition.find().sort({ day: 1, order: 1 }).lean();
    return NextResponse.json(games);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await dbConnect();
    const body = await req.json();
    const doc = await GameDefinition.create({
      name: body.name,
      slug: body.slug,
      day: body.day,
      category: body.category,
      engineKey: body.engineKey,
      settings: body.settings ?? {},
      scoring: body.scoring,
      rulesMarkdown: body.rulesMarkdown ?? "",
      order: body.order ?? 0,
      isPlayable: Boolean(body.isPlayable),
      mediaUrl: body.mediaUrl,
      mediaPublicId: body.mediaPublicId,
    });
    return NextResponse.json(doc);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
