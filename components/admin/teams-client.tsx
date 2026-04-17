"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Pencil, Trash2, Plus, Key } from "lucide-react";
import { showError, showSuccess } from "@/lib/ui/toast";

type TeamRow = { _id: string; name: string; color: string; loginUsername?: string };

export function TeamsClient({
  sessionId,
  initialTeams,
}: {
  sessionId: string;
  initialTeams: TeamRow[];
}) {
  const router = useRouter();
  const [teams, setTeams] = useState<TeamRow[]>(initialTeams);

  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editColor, setEditColor] = useState("#6366f1");

  const [newName, setNewName] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const [password, setPassword] = useState("");

  async function reload() {
    const res = await fetch(`/api/teams?sessionId=${sessionId}`);
    if (res.ok) {
      const data = await res.json();
      setTeams(Array.isArray(data) ? data : []);
    }
    router.refresh();
  }

  async function bootstrap() {
    if (!sessionId) {
      showError("Create a session first");
      return;
    }
    const res = await fetch("/api/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, bootstrap: true }),
    });
    const data = await res.json();
    if (!res.ok) {
      showError(String(data.error ?? "Failed"));
      return;
    }
    showSuccess("Teams bootstrapped");
    await reload();
  }

  function startEdit(t: TeamRow) {
    setEditId(t._id);
    setEditName(t.name);
    setEditUsername(t.loginUsername ?? "");
    setEditColor(t.color);
  }

  async function saveEdit() {
    if (!editId) return;
    const res = await fetch(`/api/teams/${editId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editName,
        loginUsername: editUsername,
        color: editColor,
      }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      showError(String(d.error ?? "Save failed"));
      return;
    }
    showSuccess("Team updated");
    setEditId(null);
    await reload();
  }

  async function addTeam() {
    if (!newName.trim()) return;
    const res = await fetch("/api/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        name: newName.trim(),
        loginUsername: newUsername.trim() || undefined,
        sortOrder: teams.length,
      }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      showError(String(d.error ?? "Failed"));
      return;
    }
    showSuccess("Team added");
    setNewName("");
    setNewUsername("");
    setShowAdd(false);
    await reload();
  }

  async function removeTeam(id: string) {
    if (!confirm("Delete this team?")) return;
    const res = await fetch(`/api/teams/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      showError(String(d.error ?? "Delete failed"));
      return;
    }
    showSuccess("Team deleted");
    await reload();
  }

  async function updatePassword() {
    if (!password || password.length < 3) {
      showError("Password must be at least 3 characters");
      return;
    }
    const res = await fetch("/api/teams", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, password }),
    });
    const d = await res.json();
    if (!res.ok) {
      showError(String(d.error ?? "Failed"));
      return;
    }
    showSuccess(`Password updated for ${d.updated} teams`);
    setPassword("");
  }

  if (!sessionId) {
    return (
      <p className="mt-4 text-sm text-amber-700 dark:text-amber-400">
        No session found. Seed the database or create a session.
      </p>
    );
  }

  return (
    <div className="mt-6 space-y-6">
      {/* Shared password */}
      <div className="ui-card rounded-xl p-4">
        <div className="flex items-center gap-2">
          <Key className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">
            Shared Team Password
          </h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          All teams use this password to log in. Set it once here.
        </p>
        <div className="mt-3 flex gap-2">
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="New password..."
            className="ui-field flex-1 rounded-lg px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => void updatePassword()}
            className="ui-button rounded-lg px-4 py-2 text-sm font-medium"
          >
            Update
          </button>
        </div>
      </div>

      {/* Bootstrap + Add buttons */}
      <div className="flex flex-wrap gap-2">
        {teams.length === 0 ? (
          <button
            type="button"
            onClick={() => void bootstrap()}
            className="ui-button-secondary rounded-xl px-4 py-2 text-sm"
          >
            Bootstrap 6 teams
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setShowAdd(!showAdd)}
          className="ui-button-secondary inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm"
        >
          <Plus className="size-3.5" />
          Add team
        </button>
      </div>

      {/* Add team form */}
      {showAdd ? (
        <div className="ui-card rounded-xl p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs">
              Team name
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="ui-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                placeholder="Team 7"
              />
            </label>
            <label className="text-xs">
              Login username
              <input
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className="ui-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                placeholder="team7"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={() => void addTeam()}
            className="ui-button mt-3 rounded-lg px-4 py-2 text-sm"
          >
            Create
          </button>
        </div>
      ) : null}

      {/* Team list */}
      <ul className="space-y-2">
        {teams.map((t) => (
          <li key={t._id} className="ui-card rounded-xl px-4 py-3">
            {editId === t._id ? (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="text-xs">
                    Name
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="ui-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="text-xs">
                    Username
                    <input
                      value={editUsername}
                      onChange={(e) => setEditUsername(e.target.value)}
                      className="ui-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="text-xs">
                    Color
                    <input
                      type="color"
                      value={editColor}
                      onChange={(e) => setEditColor(e.target.value)}
                      className="ui-field mt-1 block h-9 w-full cursor-pointer rounded-lg"
                    />
                  </label>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void saveEdit()}
                    className="ui-button rounded-lg px-3 py-1.5 text-xs"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditId(null)}
                    className="ui-button-secondary rounded-lg px-3 py-1.5 text-xs"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span
                  className="size-3 shrink-0 rounded-full"
                  style={{ backgroundColor: t.color }}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{t.name}</p>
                  {t.loginUsername ? (
                    <p className="text-xs text-muted-foreground">
                      Login: {t.loginUsername}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => startEdit(t)}
                  className="ui-button-secondary shrink-0 rounded-lg p-1.5 text-muted-foreground hover:text-foreground"
                  title="Edit"
                >
                  <Pencil className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => void removeTeam(t._id)}
                  className="ui-button-secondary shrink-0 rounded-lg p-1.5 text-accent"
                  title="Delete"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
