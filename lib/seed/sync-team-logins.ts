import type { Types } from "mongoose";
import { Team } from "@/lib/db/models";
import { hashPassword } from "@/lib/camp/password";

/** Default password for all seeded team accounts (override with TEAM_SEED_PASSWORD). */
export function getTeamSeedPassword(): string {
  return process.env.TEAM_SEED_PASSWORD?.trim() || "youthcamp";
}

/**
 * Ensures every team has a loginUsername and a password hash.
 * - Only assigns `team1`…`teamN` as a default username when the team
 *   doesn't already have one (preserves admin-set usernames).
 * - Always refreshes the password hash so TEAM_SEED_PASSWORD changes take effect.
 */
export async function syncTeamLoginsForSession(
  sessionId: Types.ObjectId,
): Promise<{ usernames: string[] }> {
  const plain = getTeamSeedPassword();
  const passwordHash = await hashPassword(plain);
  const teams = await Team.find({ sessionId }).sort({ sortOrder: 1, name: 1 });
  const usernames: string[] = [];
  let i = 0;
  for (const t of teams) {
    i += 1;
    const existing = t.loginUsername?.trim();
    const loginUsername = existing || `team${i}`;
    usernames.push(loginUsername);

    const update: Record<string, unknown> = { passwordHash };
    if (!existing) {
      update.loginUsername = loginUsername;
    }

    await Team.updateOne({ _id: t._id }, { $set: update });
  }
  return { usernames };
}
