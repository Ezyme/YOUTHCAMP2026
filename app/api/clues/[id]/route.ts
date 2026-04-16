import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db/connect";
import { Clue } from "@/lib/db/models";
import mongoose from "mongoose";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    await dbConnect();
    const { id } = await ctx.params;
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    const body = await req.json();
    const clue = await Clue.findByIdAndUpdate(
      id,
      { $set: body },
      { new: true },
    );
    if (!clue) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(clue);
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
    await Clue.findByIdAndDelete(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
