import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { CAMP_AUTH_COOKIE, CAMP_TEAM_COOKIE } from "@/lib/camp/auth";

export async function POST() {
  const jar = await cookies();
  jar.delete(CAMP_AUTH_COOKIE);
  jar.delete(CAMP_TEAM_COOKIE);
  return NextResponse.json({ ok: true });
}
