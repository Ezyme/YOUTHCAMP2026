import { dbConnect } from "@/lib/db/connect";
import { Session } from "@/lib/db/models";
import { SessionsClient } from "@/components/admin/sessions-client";

export const dynamic = "force-dynamic";

export default async function SessionsPage() {
  await dbConnect();
  const sessions = await Session.find().sort({ createdAt: -1 }).lean();

  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground">Sessions</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        A session groups teams, clues, results, and the leaderboard.
      </p>
      <SessionsClient
        initial={sessions.map((s) => ({
          _id: String(s._id),
          label: s.label,
          active: s.active,
        }))}
      />
    </div>
  );
}
