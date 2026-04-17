"use client";

import { useRouter } from "next/navigation";

type Props = {
  className?: string;
  variant?: "desktop" | "mobile";
  /** Called when the user activates logout (e.g. to close a mobile menu). */
  onNavigate?: () => void;
};

export function CampHeaderLogout({
  className,
  variant = "desktop",
  onNavigate,
}: Props) {
  const router = useRouter();
  async function logout() {
    onNavigate?.();
    await fetch("/api/camp/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  const base =
    variant === "mobile"
      ? "block rounded-lg px-3 py-2 text-sm text-card-foreground hover:bg-muted"
      : "rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground";

  return (
    <button
      type="button"
      onClick={() => void logout()}
      className={`${base} ${className ?? ""} text-left`}
    >
      Sign out
    </button>
  );
}
