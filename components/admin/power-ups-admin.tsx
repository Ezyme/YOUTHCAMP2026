"use client";

import { useEffect, useState } from "react";
import { Gift, Pencil, Trash2 } from "lucide-react";
import type { PowerUpType } from "@/lib/db/models";
import { showError, showSuccess } from "@/lib/ui/toast";

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
  const [grantingId, setGrantingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCode, setEditCode] = useState("");
  const [editType, setEditType] = useState<PowerUpType>("extra_heart");
  const [editScope, setEditScope] = useState<"universal" | "per_team">("universal");
  const [editTeamId, setEditTeamId] = useState(teams[0]?._id ?? "");
  const [patchingId, setPatchingId] = useState<string | null>(null);

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
    if (!newCode.trim()) {
      showError("Code is required");
      return;
    }
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
    if (!res.ok) {
      showError(String(data.error ?? "Failed to add code"));
      return;
    }
    showSuccess(`Code ${String(newCode).trim().toUpperCase()} added`);
    setNewCode("");
    await load();
  }

  async function remove(id: string) {
    const res = await fetch(`/api/unmasked/codes?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      showError("Delete failed");
      return;
    }
    showSuccess("Code removed");
    await load();
  }

  function startEdit(c: CodeRow) {
    setEditingId(c._id);
    setEditCode(c.code);
    setEditType(c.powerUpType);
    setEditScope(c.scope);
    setEditTeamId(c.teamId ?? teams[0]?._id ?? "");
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit() {
    if (!editingId) return;
    if (!editCode.trim()) {
      showError("Code is required");
      return;
    }
    if (editScope === "per_team" && !editTeamId) {
      showError("Choose a team for a per-team code");
      return;
    }
    setPatchingId(editingId);
    try {
      const res = await fetch("/api/unmasked/codes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId,
          sessionId,
          code: editCode.trim(),
          powerUpType: editType,
          scope: editScope,
          teamId: editScope === "per_team" ? editTeamId : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showError(String(data.error ?? "Update failed"));
        return;
      }
      showSuccess("Code updated");
      setEditingId(null);
      await load();
    } finally {
      setPatchingId(null);
    }
  }

  async function grantAllTeams(
    codeId: string,
    code: string,
    scope: "universal" | "per_team",
  ) {
    const scopeHint =
      scope === "per_team" ?
        "This code is restricted to one team — only that team will receive the grant."
      : "Every team in the camp session will be marked as redeemed and receive the power-up in Unmasked (if they have a saved game).";
    if (
      !confirm(
        `Grant code ${code} to all eligible teams without entering the code in-game?\n\n${scopeHint}`,
      )
    ) {
      return;
    }
    setGrantingId(codeId);
    try {
      const res = await fetch("/api/admin/unmasked/power-up-grant-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, codeId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showError(String(data.error ?? "Grant failed"));
        return;
      }
      const g = Number(data.grantedUnmaskedStates ?? 0);
      const skip = Number(data.skippedAlreadyHadCode ?? 0);
      const noState = Number(data.teamsWithoutUnmaskedState ?? 0);
      showSuccess(
        `Granted to ${g} team game(s). ${skip} already had it.${noState > 0 ? ` ${noState} team(s) have not opened Unmasked yet — they are marked redeemed; grant applies when they have a saved game or use redeem repair.` : ""}`,
      );
      await load();
    } finally {
      setGrantingId(null);
    }
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
      </div>

      {/* Codes list */}
      {codes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No codes yet. Add some above.</p>
      ) : (
        <ul className="space-y-2">
          {codes.map((c) => (
            <li
              key={c._id}
              className="ui-card rounded-xl px-4 py-3"
            >
              {editingId === c._id ? (
                <div className="space-y-3">
                  <p className="text-xs font-medium text-foreground">Edit code</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-xs">
                      Code (teams type this)
                      <input
                        value={editCode}
                        onChange={(e) => setEditCode(e.target.value.toUpperCase())}
                        className="ui-field mt-1 w-full rounded-lg px-3 py-2 text-sm uppercase"
                      />
                    </label>
                    <label className="text-xs">
                      Power-up type
                      <select
                        value={editType}
                        onChange={(e) => setEditType(e.target.value as PowerUpType)}
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
                        value={editScope}
                        onChange={(e) =>
                          setEditScope(e.target.value as "universal" | "per_team")
                        }
                        className="ui-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                      >
                        <option value="universal">Universal (any team, once each)</option>
                        <option value="per_team">Per-team (specific team only)</option>
                      </select>
                    </label>
                    {editScope === "per_team" ? (
                      <label className="text-xs">
                        Team
                        <select
                          value={editTeamId}
                          onChange={(e) => setEditTeamId(e.target.value)}
                          className="ui-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                        >
                          {teams.map((t) => (
                            <option key={t._id} value={t._id}>{t.name}</option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    If you change the code text, saved games that already redeemed the old text are updated to the new code automatically.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void saveEdit()}
                      disabled={patchingId === c._id}
                      className="ui-button rounded-lg px-3 py-1.5 text-xs disabled:opacity-50"
                    >
                      {patchingId === c._id ? "Saving…" : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      disabled={patchingId === c._id}
                      className="ui-button-secondary rounded-lg px-3 py-1.5 text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
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
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => startEdit(c)}
                      className="ui-button-secondary rounded-lg p-1.5 text-foreground"
                      title="Configure code"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void grantAllTeams(c._id, c.code, c.scope)}
                      disabled={grantingId === c._id}
                      className="ui-button-secondary inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-foreground disabled:opacity-50"
                      title="Mark redeemed for every eligible team and add the power-up to their Unmasked game"
                    >
                      <Gift className="size-3.5" />
                      {grantingId === c._id ? "Granting…" : "Grant all"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void remove(c._id)}
                      className="ui-button-secondary rounded-lg p-1.5 text-accent"
                      title="Delete"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
