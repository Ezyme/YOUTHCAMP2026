import Link from "next/link";
import { Menu } from "lucide-react";
import { cookies } from "next/headers";
import { CAMP_AUTH_COOKIE } from "@/lib/camp/auth";
import { CampHeaderLogout } from "@/components/camp/camp-header-logout";
import { ThemeToggle } from "@/components/theme-toggle";

export async function SiteHeader() {
  const jar = await cookies();
  const campLoggedIn = jar.get(CAMP_AUTH_COOKIE)?.value === "1";

  const adminSecret = process.env.ADMIN_SECRET?.trim();
  const adminCookie = jar.get("youthcamp_admin")?.value;
  const showAdminLink =
    !campLoggedIn && (!adminSecret || adminCookie === adminSecret);

  const baseLinks = [
    { href: "/", label: "Home" },
    { href: "/camp", label: "Team dashboard" },
    { href: "/games", label: "Games" },
    { href: "/leaderboard", label: "Leaderboard" },
  ] as const;

  const navLinkClass =
    "rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground";
  const mobileLinkClass =
    "block rounded-lg px-3 py-2 text-sm text-card-foreground hover:bg-muted";

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="font-heading text-lg tracking-wide text-foreground"
        >
          YouthCamp Games
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <nav className="hidden items-center gap-1 sm:flex">
            {baseLinks.map((l) => (
              <Link key={l.href} href={l.href} className={navLinkClass}>
                {l.label}
              </Link>
            ))}
            {campLoggedIn ? (
              <CampHeaderLogout variant="desktop" />
            ) : (
              <Link href="/login" className={navLinkClass}>
                Login
              </Link>
            )}
            {showAdminLink ? (
              <Link href="/admin" className={navLinkClass}>
                Admin
              </Link>
            ) : null}
          </nav>
          <ThemeToggle />
          <details className="relative sm:hidden">
            <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground">
              <Menu className="size-4" />
              Menu
            </summary>
            <div className="absolute right-0 mt-2 w-48 rounded-xl border border-border bg-card p-2 shadow-lg">
              {baseLinks.map((l) => (
                <Link key={l.href} href={l.href} className={mobileLinkClass}>
                  {l.label}
                </Link>
              ))}
              {campLoggedIn ? (
                <CampHeaderLogout variant="mobile" />
              ) : (
                <Link href="/login" className={mobileLinkClass}>
                  Login
                </Link>
              )}
              {showAdminLink ? (
                <Link href="/admin" className={mobileLinkClass}>
                  Admin
                </Link>
              ) : null}
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
