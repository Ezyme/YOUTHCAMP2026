import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db/connect";
import { Session } from "@/lib/db/models";

export async function GET() {
  try {
    await dbConnect();
    const sessions = await Session.find().sort({ createdAt: -1 }).lean();
    return NextResponse.json(sessions);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await dbConnect();
    const body = await req.json();
    const label = String(body.label ?? "New session");
    const doc = await Session.create({ label, active: true });
    return NextResponse.json(doc);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
