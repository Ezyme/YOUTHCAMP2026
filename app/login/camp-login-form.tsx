"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Shield } from "lucide-react";
import { safeCampLoginNext } from "@/lib/camp/auth";
import { showError, showSuccess } from "@/lib/ui/toast";

export function CampLoginForm() {
  const searchParams = useSearchParams();
  const next = safeCampLoginNext(searchParams.get("next"));
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/camp/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showError(String(data.error ?? "Login failed"));
        return;
      }
      showSuccess("Welcome back!");
      // Full navigation so the new httpOnly session cookies are always sent on the
      // next request (avoids soft-nav edge cases) and the button cannot stay stuck.
      window.location.assign(next);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
      <div className="text-center">
        <Shield className="mx-auto size-10 text-primary" />
        <h1 className="mt-3 text-2xl font-semibold text-foreground">
          Welcome, Camper!
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in with your team credentials to access games and the dashboard.
        </p>
      </div>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <label className="block text-sm">
          <span className="text-muted-foreground">Team Username</span>
          <input
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your team username"
            className="ui-field mt-1 w-full rounded-xl px-4 py-3 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted-foreground">Password</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter the camp password"
            className="ui-field mt-1 w-full rounded-xl px-4 py-3 text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="ui-button w-full rounded-xl py-3 text-sm font-medium disabled:opacity-60"
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </main>
  );
}
