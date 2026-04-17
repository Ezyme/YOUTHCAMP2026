"use client";

import { useState } from "react";
import { showError, showSuccess } from "@/lib/ui/toast";

const validators = ["normalized", "exact", "numeric", "ordered_tokens", "regex"];

export function FinalPuzzleForm({ sessionId }: { sessionId: string }) {
  const [solutionPlain, setSolutionPlain] = useState("");
  const [validatorType, setValidatorType] = useState("normalized");
  const [pattern, setPattern] = useState("");
  const [teamId, setTeamId] = useState("");

  async function save() {
    const validatorConfig =
      validatorType === "regex" ? { pattern } : {};
    const res = await fetch("/api/final-puzzle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        solutionPlain,
        validatorType,
        validatorConfig,
        teamId: teamId || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      showError(String(data.error ?? "Failed"));
      return;
    }
    showSuccess("Puzzle saved (solution hashed)");
  }

  if (!sessionId) {
    return <p className="text-sm text-accent">No session.</p>;
  }

  return (
    <div className="max-w-lg space-y-4">
      <label className="block text-sm">
        Validator
        <select
          className="ui-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
          value={validatorType}
          onChange={(e) => setValidatorType(e.target.value)}
        >
          {validators.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </label>
      {validatorType === "regex" ? (
        <label className="block text-sm">
          Pattern
          <input
            className="ui-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
          />
        </label>
      ) : null}
      <label className="block text-sm">
        Correct answer (plain — hashed server-side)
        <input
          className="ui-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
          value={solutionPlain}
          onChange={(e) => setSolutionPlain(e.target.value)}
        />
      </label>
      <label className="block text-sm">
        Team id (optional — leave empty for global puzzle)
        <input
          className="ui-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
          value={teamId}
          onChange={(e) => setTeamId(e.target.value)}
          placeholder="Global if empty"
        />
      </label>
      <button
        type="button"
        onClick={save}
        className="ui-button rounded-xl px-4 py-2 text-sm"
      >
        Save puzzle
      </button>
    </div>
  );
}
