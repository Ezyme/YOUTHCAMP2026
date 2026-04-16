import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db/connect";
import { GameDefinition } from "@/lib/db/models";

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    await dbConnect();
    const { slug } = await ctx.params;
    const game = await GameDefinition.findOne({ slug }).lean();
    if (!game) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(game);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
