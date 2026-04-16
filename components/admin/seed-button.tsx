"use client";

import { useState } from "react";

export function SeedButton() {
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    setMsg("");
    try {
      const secret =
        typeof window !== "undefined"
          ? window.prompt("ADMIN_SECRET (optional if unset)") ?? ""
          : "";
      const res = await fetch("/api/seed", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(secret ? { "x-admin-secret": secret } : {}),
        },
        body: JSON.stringify(secret ? { secret } : {}),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error ?? "Seed failed");
        return;
      }
      const hint =
        data.teamPasswordNote && data.teamLoginUsernames
          ? ` Logins: ${data.teamLoginUsernames.join(", ")} — ${data.teamPasswordNote}`
          : "";
      setMsg(`Seeded. Session: ${data.sessionId}.${hint}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={run}
        disabled={loading}
        className="ui-button-secondary rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        {loading ? "Seeding…" : "Run idempotent seed"}
      </button>
      {msg ? <p className="text-xs text-muted-foreground">{msg}</p> : null}
    </div>
  );
}
