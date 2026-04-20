import Link from "next/link";

const adminLinks = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/games", label: "Games" },
  { href: "/admin/teams", label: "Teams" },
  { href: "/admin/scoring", label: "Scoring" },
  { href: "/admin/unmasked", label: "Unmasked" },
  { href: "/admin/power-ups", label: "Power-ups" },
];

export default function AdminPanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:flex-row sm:px-6">
      <aside className="shrink-0 sm:w-52">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Admin
        </p>
        <nav className="mt-3 flex flex-row flex-wrap gap-2 sm:flex-col sm:gap-1">
          {adminLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
