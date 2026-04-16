import { GameForm } from "@/components/admin/game-form";

export default function NewGamePage() {
  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground">New game</h1>
      <div className="mt-6">
        <GameForm />
      </div>
    </div>
  );
}
