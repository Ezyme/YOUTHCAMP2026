"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { CampHeaderLogout } from "@/components/camp/camp-header-logout";

const mobileLinkClass =
  "block rounded-lg px-3 py-2 text-sm text-card-foreground hover:bg-muted";

type BaseLink = { readonly href: string; readonly label: string };

export function MobileNavMenu({
  baseLinks,
  campLoggedIn,
  showAdminLink,
}: {
  baseLinks: readonly BaseLink[];
  campLoggedIn: boolean;
  showAdminLink: boolean;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  function closeMenu() {
    const el = detailsRef.current;
    if (el) el.open = false;
  }

  useEffect(() => {
    function handlePointerDown(e: MouseEvent | TouchEvent) {
      const el = detailsRef.current;
      if (!el?.open) return;
      const target = e.target;
      if (target instanceof Node && el.contains(target)) return;
      el.open = false;
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, []);

  return (
    <details ref={detailsRef} className="relative sm:hidden">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground [&::-webkit-details-marker]:hidden">
        <Menu className="size-4" />
        Menu
      </summary>
      <div className="absolute right-0 mt-2 w-48 rounded-xl border border-border bg-card p-2 shadow-lg">
        {baseLinks.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={mobileLinkClass}
            onClick={closeMenu}
          >
            {l.label}
          </Link>
        ))}
        {campLoggedIn ? (
          <CampHeaderLogout variant="mobile" onNavigate={closeMenu} />
        ) : (
          <Link href="/login" className={mobileLinkClass} onClick={closeMenu}>
            Login
          </Link>
        )}
        {showAdminLink ? (
          <Link href="/admin" className={mobileLinkClass} onClick={closeMenu}>
            Admin
          </Link>
        ) : null}
      </div>
    </details>
  );
}
