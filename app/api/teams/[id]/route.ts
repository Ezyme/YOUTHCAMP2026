import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db/connect";
import { Team } from "@/lib/db/models";
import mongoose from "mongoose";

type Props = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Props) {
  try {
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    await dbConnect();
    const body = await req.json();

    const updates: Record<string, unknown> = {};
    if (body.name != null) updates.name = String(body.name);
    if (body.color != null) updates.color = String(body.color);
    if (body.loginUsername != null) {
      updates.loginUsername = String(body.loginUsername).trim().toLowerCase();
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const doc = await Team.findByIdAndUpdate(id, { $set: updates }, { new: true })
      .select("-passwordHash");
    if (!doc) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    return NextResponse.json(doc);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: Props) {
  try {
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    await dbConnect();
    await Team.deleteOne({ _id: id });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
