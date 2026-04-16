import { CampDashboard } from "@/components/camp/camp-dashboard";
import { CampLogoutButton } from "@/components/camp/camp-logout-button";
import { dbConnect } from "@/lib/db/connect";
import { CAMP_TEAM_COOKIE } from "@/lib/camp/auth";
import { Session, Team } from "@/lib/db/models";
import { getComebackAnalytics } from "@/lib/scoring/comeback";
import { cookies } from "next/headers";
import mongoose from "mongoose";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CampPage() {
  await dbConnect();
  const jar = await cookies();
  const cookieTeam = jar.get(CAMP_TEAM_COOKIE)?.value ?? "";
  const session = await Session.findOne().sort({ createdAt: -1 });
  if (!session) {
    return (
      <main className="mx-auto max-w-3xl flex-1 px-4 py-10">
        <p className="text-sm text-muted-foreground">
          No session — run seed from Admin.
        </p>
        <Link href="/admin" className="mt-4 inline-block text-primary">
          Admin
        </Link>
      </main>
    );
  }
  const sessionId = String(session._id);
  const teams = await Team.find({ sessionId: session._id })
    .sort({ sortOrder: 1, name: 1 })
    .lean();

  const teamOpts = teams.map((t) => ({
    id: String(t._id),
    name: t.name,
    color: t.color,
  }));

  const effectiveTeamId =
    cookieTeam && mongoose.isValidObjectId(cookieTeam) ? cookieTeam : "";

  if (!effectiveTeamId) {
    redirect("/login?next=/camp");
  }

  const initialAnalytics =
    effectiveTeamId && mongoose.isValidObjectId(effectiveTeamId)
      ? await getComebackAnalytics(sessionId, effectiveTeamId)
      : null;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Team dashboard
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-foreground">
            {session.label}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Track leaderboard position, comeback outlook, and per-game max
            points. Mindgame opens as a shared board for the selected group.
          </p>
        </div>
        <CampLogoutButton />
      </div>

      <div className="mt-8">
        <CampDashboard
          sessionId={sessionId}
          initialTeamId={effectiveTeamId}
          teams={teamOpts}
          initialAnalytics={initialAnalytics}
        />
      </div>
      <p className="mt-10 text-center text-sm text-muted-foreground">
        <Link href="/leaderboard" className="text-primary hover:underline">
          Full leaderboard
        </Link>
      </p>
    </main>
  );
}
