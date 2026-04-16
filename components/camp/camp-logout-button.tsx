"use client";

import { useRouter } from "next/navigation";

export function CampLogoutButton() {
  const router = useRouter();
  async function logout() {
    await fetch("/api/camp/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }
  return (
    <button
      type="button"
      onClick={() => void logout()}
      className="text-sm text-muted-foreground underline hover:text-foreground"
    >
      Log out
    </button>
  );
}
