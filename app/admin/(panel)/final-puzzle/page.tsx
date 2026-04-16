import { FinalPuzzleForm } from "@/components/admin/final-puzzle-form";
import { dbConnect } from "@/lib/db/connect";
import { Session } from "@/lib/db/models";

export const dynamic = "force-dynamic";

export default async function FinalPuzzlePage() {
  await dbConnect();
  const session = await Session.findOne().sort({ createdAt: -1 });
  const sessionId = session ? String(session._id) : "";

  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground">Final puzzle</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Configure validation for Final Solving. Answers are checked server-side.
      </p>
      <div className="mt-6">
        <FinalPuzzleForm sessionId={sessionId} />
      </div>
    </div>
  );
}
