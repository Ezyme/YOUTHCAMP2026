import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db/connect";
import { GameDefinition } from "@/lib/db/models";
import mongoose from "mongoose";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    await dbConnect();
    const { id } = await ctx.params;
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    const game = await GameDefinition.findById(id).lean();
    if (!game) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(game);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    await dbConnect();
    const { id } = await ctx.params;
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    const body = await req.json();
    const game = await GameDefinition.findByIdAndUpdate(
      id,
      { $set: body },
      { new: true, runValidators: true },
    );
    if (!game) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(game);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    await dbConnect();
    const { id } = await ctx.params;
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    await GameDefinition.findByIdAndDelete(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
