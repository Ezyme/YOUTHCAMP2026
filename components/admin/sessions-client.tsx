"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { showError, showSuccess } from "@/lib/ui/toast";

type S = { _id: string; label: string; active: boolean };

export function SessionsClient({ initial }: { initial: S[] }) {
  const router = useRouter();
  const [label, setLabel] = useState("New session");

  async function create() {
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label }),
    });
    const data = await res.json();
    if (!res.ok) {
      showError(String(data.error ?? "Failed to create session"));
      return;
    }
    showSuccess("Session created");
    router.refresh();
  }

  return (
    <div className="mt-6 space-y-6">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm">
          <span className="text-muted-foreground">Label</span>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="ui-field mt-1 rounded-lg px-3 py-2 text-sm"
          />
        </label>
        <button
          type="button"
          onClick={create}
          className="ui-button rounded-xl px-4 py-2 text-sm"
        >
          Create session
        </button>
      </div>
      <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
        {initial.map((s) => (
          <li key={s._id} className="px-4 py-3 text-sm">
            <span className="font-medium">{s.label}</span>
            <span className="ml-2 text-xs text-muted-foreground">{s._id}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
