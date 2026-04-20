"use client";

import { useState } from "react";

export function ResetCampButton() {
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function run() {
    const ok = window.confirm(
      "Reset the entire camp? This removes all scores, placements, mind game progress, Unmasked runs, and power-up redemptions. Game definitions and team accounts are kept.",
    );
    if (!ok) return;

    setLoading(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/reset-camp", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error ?? "Reset failed");
        return;
      }
      setMsg(
        `Camp reset. Removed ${data.deletedGameResults} score rows, ${data.deletedMindgameStates} mind game states, ${data.deletedUnmaskedStates} Unmasked states; cleared redemptions on ${data.powerUpCodesRedemptionsCleared} power-up codes.`,
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => void run()}
        disabled={loading}
        className="ui-button-accent rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        {loading ? "Resetting…" : "Reset camp"}
      </button>
      {msg ? <p className="text-xs text-muted-foreground">{msg}</p> : null}
    </div>
  );
}
