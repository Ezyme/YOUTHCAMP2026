import { ResetCampButton } from "@/components/admin/reset-camp-button";
import { SeedButton } from "@/components/admin/seed-button";
import Link from "next/link";

export default function AdminHomePage() {
  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Seed camp games and default session/teams, then manage definitions and
        scoring.
      </p>
      <div className="ui-card mt-6 rounded-2xl p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-card-foreground">Bootstrap</h2>
        <p className="mt-2 text-xs text-muted-foreground">
          Upserts all Day 0–2 games from the camp list and creates a session with
          six teams if empty.
        </p>
        <div className="mt-4">
          <SeedButton />
        </div>
      </div>
      <div className="ui-card mt-6 rounded-2xl p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-card-foreground">Reset camp</h2>
        <p className="mt-2 text-xs text-muted-foreground">
          Clears all facilitator scores, mind game and Unmasked progress, and power-up
          redemptions for the active session. Game definitions and team logins are
          unchanged.
        </p>
        <div className="mt-4">
          <ResetCampButton />
        </div>
      </div>
      <ul className="mt-8 grid gap-3 sm:grid-cols-2">
        {[
          { href: "/admin/games", t: "Games", d: "CRUD definitions & scoring rows" },
          { href: "/admin/scoring", t: "Scoring", d: "Enter 1st–6th per game" },
          { href: "/admin/power-ups", t: "Power-ups", d: "Unmasked game power-up codes" },
          { href: "/leaderboard", t: "Leaderboard", d: "Public totals" },
        ].map((x) => (
          <li key={x.href}>
            <Link
              href={x.href}
              className="ui-card block rounded-2xl p-4 shadow-sm transition hover:bg-muted/80"
            >
              <span className="font-medium text-card-foreground">{x.t}</span>
              <p className="mt-1 text-xs text-muted-foreground">{x.d}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
