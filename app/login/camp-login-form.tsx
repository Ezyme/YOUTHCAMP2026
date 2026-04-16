"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Shield } from "lucide-react";

export function CampLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/camp";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/camp/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(String(data.error ?? "Login failed"));
      setLoading(false);
      return;
    }
    router.push(next);
    router.refresh();
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
        {error ? (
          <p className="rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-accent">
            {error}
          </p>
        ) : null}
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
