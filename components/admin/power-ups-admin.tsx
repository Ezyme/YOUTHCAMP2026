"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import type { PowerUpType } from "@/lib/db/models";

type CodeRow = {
  _id: string;
  code: string;
  powerUpType: PowerUpType;
  scope: "universal" | "per_team";
  teamId?: string;
  teamName?: string | null;
  redeemedBy: string[];
  redeemedByNames: string[];
};

type Team = { _id: string; name: string };

const POWER_UP_OPTIONS: { value: PowerUpType; label: string }[] = [
  { value: "extra_heart", label: "Extra Heart (+1 life)" },
  { value: "reveal", label: "Reveal (show a safe tile)" },
  { value: "scout", label: "Scout (peek at a tile)" },
  { value: "shield", label: "Shield (block next lie)" },
  {
    value: "safe_opening",
    label: "Safe opening (largest clear patch — best first “click”)",
  },
  {
    value: "truth_radar",
    label: "Truth Radar (reveal 1 nearest lie on row or column)",
  },
  {
    value: "lie_pin",
    label: "Lie Pin (flag 1 hidden lie)",
  },
  {
    value: "verse_compass",
    label: "Verse Compass (reveal 2 nearest verse fragments)",
  },
  {
    value: "gentle_step",
    label: "Gentle Step (reveal 1 safe square, no spread)",
  },
];

export function PowerUpsAdmin({
  sessionId,
  teams,
}: {
  sessionId: string;
  teams: Team[];
}) {
  const [codes, setCodes] = useState<CodeRow[]>([]);
  const [newCode, setNewCode] = useState("");
  const [newType, setNewType] = useState<PowerUpType>("extra_heart");
  const [newScope, setNewScope] = useState<"universal" | "per_team">("universal");
  const [newTeamId, setNewTeamId] = useState(teams[0]?._id ?? "");
  const [msg, setMsg] = useState("");

  async function load() {
    if (!sessionId) return;
    const res = await fetch(`/api/unmasked/codes?sessionId=${sessionId}`);
    if (res.ok) {
      const data = await res.json();
      setCodes(Array.isArray(data) ? data : []);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  async function add() {
    setMsg("");
    if (!newCode.trim()) { setMsg("Code is required"); return; }
    const res = await fetch("/api/unmasked/codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        code: newCode.trim(),
        powerUpType: newType,
        scope: newScope,
        teamId: newScope === "per_team" ? newTeamId : undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) { setMsg(data.error ?? "Failed"); return; }
    setNewCode("");
    await load();
  }

  async function remove(id: string) {
    await fetch(`/api/unmasked/codes?id=${id}`, { method: "DELETE" });
    await load();
  }

  if (!sessionId) {
    return <p className="mt-4 text-sm text-amber-700">No session.</p>;
  }

  return (
    <div className="mt-6 space-y-6">
      {/* Add code form */}
      <div className="ui-card rounded-xl p-4">
        <h2 className="text-sm font-semibold text-foreground">
          Add Power-Up Code
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-xs">
            Code (teams type this)
            <input
              value={newCode}
              onChange={(e) => setNewCode(e.target.value.toUpperCase())}
              placeholder="CHOSEN"
              className="ui-field mt-1 w-full rounded-lg px-3 py-2 text-sm uppercase"
            />
          </label>
          <label className="text-xs">
            Power-up type
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as PowerUpType)}
              className="ui-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
            >
              {POWER_UP_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            Scope
            <select
              value={newScope}
              onChange={(e) => setNewScope(e.target.value as "universal" | "per_team")}
              className="ui-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
            >
              <option value="universal">Universal (any team, once each)</option>
              <option value="per_team">Per-team (specific team only)</option>
            </select>
          </label>
          {newScope === "per_team" ? (
            <label className="text-xs">
              Team
              <select
                value={newTeamId}
                onChange={(e) => setNewTeamId(e.target.value)}
                className="ui-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
              >
                {teams.map((t) => (
                  <option key={t._id} value={t._id}>{t.name}</option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => void add()}
          className="ui-button mt-3 rounded-xl px-4 py-2 text-sm"
        >
          Add code
        </button>
        {msg ? <p className="mt-2 text-xs text-accent">{msg}</p> : null}
      </div>

      {/* Codes list */}
      {codes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No codes yet. Add some above.</p>
      ) : (
        <ul className="space-y-2">
          {codes.map((c) => (
            <li
              key={c._id}
              className="ui-card flex items-start justify-between gap-3 rounded-xl px-4 py-3"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <code className="rounded bg-muted px-2 py-0.5 text-sm font-bold text-foreground">
                    {c.code}
                  </code>
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">
                    {POWER_UP_OPTIONS.find((o) => o.value === c.powerUpType)?.label ?? c.powerUpType}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {c.scope === "per_team" ? `Team: ${c.teamName ?? "?"}` : "Universal"}
                  </span>
                </div>
                {c.redeemedByNames.length > 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Redeemed by: {c.redeemedByNames.join(", ")}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">Not redeemed yet</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => void remove(c._id)}
                className="ui-button-secondary shrink-0 rounded-lg p-1.5 text-accent"
                title="Delete"
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
