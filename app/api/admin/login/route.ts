import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: true, message: "No ADMIN_SECRET set" });
  }
  const body = await req.json().catch(() => ({}));
  if (body.secret !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const jar = await cookies();
  jar.set("youthcamp_admin", secret, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return NextResponse.json({ ok: true });
}
