"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/admin";
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret }),
    });
    if (!res.ok) {
      setError("Invalid secret");
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
      <h1 className="text-xl font-semibold text-foreground">Admin login</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Enter the shared admin secret configured in{" "}
        <code className="rounded bg-muted px-1 text-foreground">ADMIN_SECRET</code>.
        Leave unset in dev to skip gating.
      </p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <input
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="Secret"
          className="ui-field w-full rounded-xl px-4 py-3 text-sm"
        />
        {error ? (
          <p className="text-sm text-accent">{error}</p>
        ) : null}
        <button
          type="submit"
          className="ui-button w-full rounded-xl py-3 text-sm font-medium"
        >
          Continue
        </button>
      </form>
    </main>
  );
}
