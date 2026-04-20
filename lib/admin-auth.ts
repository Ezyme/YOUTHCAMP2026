import { cookies } from "next/headers";

/** Matches `middleware.ts`: if `ADMIN_SECRET` is unset, admin routes are open. */
export async function verifyAdminRequest(): Promise<boolean> {
  const secret = process.env.ADMIN_SECRET?.trim();
  if (!secret) return true;
  const jar = await cookies();
  return jar.get("youthcamp_admin")?.value === secret;
}
