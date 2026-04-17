"use client";

import { useEffect, useState } from "react";
import { showError, showSuccess } from "@/lib/ui/toast";

type Clue = {
  _id: string;
  teamId: string;
  sourceGameSlug: string;
  text: string;
  order: number;
};

type Team = { _id: string; name: string };

export function CluesAdmin({
  sessionId,
  teams,
  gameSlugs,
}: {
  sessionId: string;
  teams: Team[];
  gameSlugs: string[];
}) {
  const [teamId, setTeamId] = useState(teams[0]?._id ?? "");
  const [clues, setClues] = useState<Clue[]>([]);
  const [text, setText] = useState("");
  const [slug, setSlug] = useState(gameSlugs[0] ?? "");
  const [order, setOrder] = useState(0);

  async function load() {
    if (!sessionId || !teamId) return;
    const res = await fetch(
      `/api/clues?sessionId=${sessionId}&teamId=${teamId}`,
    );
    const data = await res.json();
    setClues(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load when selection changes
  }, [sessionId, teamId]);

  async function add() {
    if (!text.trim()) {
      showError("Clue text is required");
      return;
    }
    const res = await fetch("/api/clues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        teamId,
        sourceGameSlug: slug,
        text,
        order,
      }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      showError(String(d.error ?? "Failed to add clue"));
      return;
    }
    showSuccess("Clue added");
    setText("");
    load();
  }

  async function remove(id: string) {
    const res = await fetch(`/api/clues/${id}`, { method: "DELETE" });
    if (!res.ok) {
      showError("Delete failed");
      return;
    }
    showSuccess("Clue removed");
    load();
  }

  if (!sessionId) {
    return <p className="text-sm text-amber-700">No session.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <label className="text-sm">
          Team
          <select
            className="ui-field mt-1 block rounded-lg px-3 py-2 text-sm"
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
          >
            {teams.map((t) => (
              <option key={t._id} value={t._id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="ui-card rounded-xl p-4">
        <h2 className="text-sm font-semibold text-foreground">Add clue</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-xs">
            Source game slug
            <select
              className="ui-field mt-1 w-full rounded-lg px-2 py-2 text-xs"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
            >
              {gameSlugs.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            Order
            <input
              type="number"
              className="ui-field mt-1 w-full rounded-lg px-2 py-2 text-xs"
              value={order}
              onChange={(e) => setOrder(Number(e.target.value))}
            />
          </label>
        </div>
        <label className="mt-3 block text-xs">
          Text
          <textarea
            className="ui-field mt-1 w-full rounded-lg px-2 py-2 text-xs"
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        <button
          type="button"
          onClick={add}
          className="ui-button mt-3 rounded-xl px-4 py-2 text-sm"
        >
          Add clue
        </button>
      </div>

      <ul className="space-y-2">
        {clues.map((c) => (
          <li
            key={c._id}
            className="ui-card flex items-start justify-between gap-2 rounded-lg px-3 py-2 text-sm"
          >
            <div>
              <p className="text-xs text-muted-foreground">
                {c.sourceGameSlug} · order {c.order}
              </p>
              <p className="text-foreground">{c.text}</p>
            </div>
            <button
              type="button"
              onClick={() => remove(c._id)}
              className="shrink-0 text-xs text-accent"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
