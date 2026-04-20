"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { EngineKey, ScoringMode } from "@/lib/db/models";
import { IDENTITY_VERSES } from "@/lib/games/unmasked/verses";
import { showError, showSuccess } from "@/lib/ui/toast";

export type GameFormValues = {
  _id?: string;
  name: string;
  slug: string;
  day: number;
  category: string;
  engineKey: EngineKey;
  isPlayable: boolean;
  order: number;
  rulesMarkdown: string;
  settings?: Record<string, unknown>;
  scoring: {
    maxPlacements: number;
    scoringMode: ScoringMode;
    placementPoints: number[];
    weight: number;
    manualPointsMax?: number;
  };
};

const emptyPoints = [12, 11, 10, 9, 8, 7];

export function GameForm({
  initial,
}: {
  initial?: Partial<GameFormValues>;
}) {
  const router = useRouter();
  const initSettings = initial?.settings ?? {};
  const [v, setV] = useState<GameFormValues>({
    name: initial?.name ?? "",
    slug: initial?.slug ?? "",
    day: initial?.day ?? 0,
    category: initial?.category ?? "",
    engineKey: initial?.engineKey ?? "config_only",
    isPlayable: initial?.isPlayable ?? false,
    order: initial?.order ?? 0,
    rulesMarkdown: initial?.rulesMarkdown ?? "",
    settings: initSettings,
    scoring: {
      maxPlacements: initial?.scoring?.maxPlacements ?? 6,
      scoringMode: initial?.scoring?.scoringMode ?? "placement_points",
      placementPoints: initial?.scoring?.placementPoints?.length
        ? [...initial.scoring.placementPoints]
        : [...emptyPoints],
      weight: initial?.scoring?.weight ?? 1,
      manualPointsMax: initial?.scoring?.manualPointsMax,
    },
  });
  const isEdit = Boolean(initial?._id);

  function setPoint(i: number, val: string) {
    const n = Number(val);
    const next = [...v.scoring.placementPoints];
    next[i] = Number.isNaN(n) ? 0 : n;
    setV({ ...v, scoring: { ...v.scoring, placementPoints: next } });
  }

  async function save() {
    const payload = {
      name: v.name,
      slug: v.slug,
      day: v.day,
      category: v.category,
      engineKey: v.engineKey,
      isPlayable: v.isPlayable,
      order: v.order,
      rulesMarkdown: v.rulesMarkdown,
      settings: v.settings ?? {},
      scoring: v.scoring,
    };
    const url = isEdit ? `/api/games/${initial!._id}` : "/api/games";
    const res = await fetch(url, {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      showError(String(data.error ?? "Save failed"));
      return;
    }
    showSuccess(isEdit ? "Game updated" : "Game created");
    router.push("/admin/games");
    router.refresh();
  }

  async function remove() {
    if (!isEdit || !initial?._id) return;
    if (!confirm("Delete this game definition?")) return;
    const res = await fetch(`/api/games/${initial._id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showError(String(data.error ?? "Delete failed"));
      return;
    }
    showSuccess("Game deleted");
    router.push("/admin/games");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-muted-foreground">Name</span>
          <input
            className="ui-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
            value={v.name}
            onChange={(e) => setV({ ...v, name: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted-foreground">Slug</span>
          <input
            className="ui-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
            value={v.slug}
            onChange={(e) => setV({ ...v, slug: e.target.value })}
            disabled={isEdit}
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted-foreground">Day (0–2)</span>
          <input
            type="number"
            min={0}
            max={2}
            className="ui-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
            value={v.day}
            onChange={(e) => setV({ ...v, day: Number(e.target.value) })}
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted-foreground">Category</span>
          <input
            className="ui-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
            value={v.category}
            onChange={(e) => setV({ ...v, category: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted-foreground">Engine</span>
          <select
            className="ui-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
            value={v.engineKey}
            onChange={(e) =>
              setV({ ...v, engineKey: e.target.value as EngineKey })
            }
          >
            <option value="config_only">config_only</option>
            <option value="mindgame">mindgame</option>
            <option value="unmasked">unmasked</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={v.isPlayable}
            onChange={(e) => setV({ ...v, isPlayable: e.target.checked })}
          />
          Playable in app
        </label>
        <label className="block text-sm">
          <span className="text-muted-foreground">Sort order</span>
          <input
            type="number"
            className="ui-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
            value={v.order}
            onChange={(e) => setV({ ...v, order: Number(e.target.value) })}
          />
        </label>
      </div>

      {v.engineKey === "unmasked" ? (
        <div className="ui-card-muted rounded-xl p-4">
          <h2 className="text-sm font-semibold text-foreground">
            Unmasked Settings
          </h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-muted-foreground">Grid size</span>
              <select
                className="ui-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                value={String(v.settings?.gridSize ?? "20")}
                onChange={(e) =>
                  setV({
                    ...v,
                    settings: { ...v.settings, gridSize: Number(e.target.value) },
                  })
                }
              >
                <option value="10">10 × 10</option>
                <option value="12">12 × 12</option>
                <option value="14">14 × 14</option>
                <option value="16">16 × 16 (default)</option>
                <option value="18">18 × 18</option>
                <option value="20">20 × 20</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-muted-foreground">Difficulty</span>
              <select
                className="ui-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                value={String(v.settings?.difficulty ?? "medium")}
                onChange={(e) =>
                  setV({
                    ...v,
                    settings: { ...v.settings, difficulty: e.target.value },
                  })
                }
              >
                <option value="easy">Easy (12% lies)</option>
                <option value="medium">Medium (16% lies)</option>
                <option value="hard">Hard (20% lies, searches for a 5 clue)</option>
                <option value="expert">Expert (24% lies, 5 clues common)</option>
                <option value="intense">Intense (28% lies, very dense)</option>
              </select>
              <p className="mt-1 text-xs text-muted-foreground">
                Hard+ tries many seeds so at least one tile shows <strong>5</strong> adjacent lies when the board is
                large enough.
              </p>
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="text-muted-foreground">
                Safe opening power-up — minimum cascade size (tiles revealed)
              </span>
              <input
                type="number"
                min={0}
                max={200}
                className="ui-field mt-1 w-full max-w-xs rounded-lg px-3 py-2 text-sm"
                value={Number(v.settings?.safeOpeningMinTiles ?? 0)}
                onChange={(e) =>
                  setV({
                    ...v,
                    settings: {
                      ...v.settings,
                      safeOpeningMinTiles: Math.max(0, Number(e.target.value) || 0),
                    },
                  })
                }
              />
              <p className="mt-1 text-xs text-muted-foreground">
                <strong>0</strong> = always use the largest available safe patch. If you set e.g. <strong>12</strong>, the
                power-up only fires when that big an opening still exists; otherwise it is not consumed (players can try
                again after revealing more).
              </p>
            </label>
            <label className="block text-sm">
              <span className="text-muted-foreground">Board seed</span>
              <input
                type="number"
                className="ui-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                placeholder="Random if empty"
                value={v.settings?.seed != null ? String(v.settings.seed) : ""}
                onChange={(e) =>
                  setV({
                    ...v,
                    settings: {
                      ...v.settings,
                      seed: e.target.value ? Number(e.target.value) : undefined,
                    },
                  })
                }
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="text-muted-foreground">
                Passages on the board (min 4)
              </span>
              <input
                type="number"
                min={4}
                max={IDENTITY_VERSES.length}
                className="ui-field mt-1 w-full max-w-xs rounded-lg px-3 py-2 text-sm"
                value={Number(v.settings?.verseCount ?? 4)}
                onChange={(e) =>
                  setV({
                    ...v,
                    settings: {
                      ...v.settings,
                      verseCount: Math.min(
                        IDENTITY_VERSES.length,
                        Math.max(4, Number(e.target.value) || 4),
                      ),
                    },
                  })
                }
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Each passage is split into on-board fragments. Players never see the reference — only the text
                they reveal.
              </p>
            </label>
            <div className="sm:col-span-2">
              <span className="text-sm text-muted-foreground">
                Verse pool (admin only — leave empty to use all)
              </span>
              <div className="mt-2 max-h-40 space-y-1.5 overflow-y-auto rounded-lg border border-border bg-card p-2">
                {IDENTITY_VERSES.map((vs) => {
                  const pool = (v.settings?.versePoolKeys as string[] | undefined) ?? [];
                  const checked = pool.includes(vs.key);
                  return (
                    <label
                      key={vs.key}
                      className="flex cursor-pointer items-start gap-2 rounded px-2 py-1 text-xs hover:bg-muted"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          const next = checked
                            ? pool.filter((k) => k !== vs.key)
                            : [...pool, vs.key];
                          setV({
                            ...v,
                            settings: { ...v.settings, versePoolKeys: next },
                          });
                        }}
                        className="mt-0.5"
                      />
                      <span>
                        <span className="font-medium text-foreground">
                          {vs.reference}
                        </span>
                        <span className="block text-muted-foreground">
                          {vs.full.slice(0, 72)}…
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="ui-card rounded-xl p-4">
        <h2 className="text-sm font-semibold text-foreground">Scoring</h2>
        <label className="mt-3 block text-sm">
          <span className="text-muted-foreground">Mode</span>
          <select
            className="ui-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
            value={v.scoring.scoringMode}
            onChange={(e) =>
              setV({
                ...v,
                scoring: {
                  ...v.scoring,
                  scoringMode: e.target.value as ScoringMode,
                },
              })
            }
          >
            <option value="placement_points">placement_points</option>
            <option value="amazing_race_finish">amazing_race_finish</option>
            <option value="amazing_race_first_only">
              amazing_race_first_only (only 1st earns pts)
            </option>
            <option value="manual_points">
              manual_points (per-team score, max below)
            </option>
          </select>
        </label>
        {v.scoring.scoringMode === "manual_points" ? (
          <label className="mt-3 block text-sm">
            <span className="text-muted-foreground">
              Max points per team (/100 slice)
            </span>
            <input
              type="number"
              step={0.5}
              min={0}
              max={100}
              className="ui-field mt-1 w-full max-w-xs rounded-lg px-3 py-2 text-sm"
              value={v.scoring.manualPointsMax ?? 10}
              onChange={(e) =>
                setV({
                  ...v,
                  scoring: {
                    ...v.scoring,
                    manualPointsMax: Number(e.target.value),
                  },
                })
              }
            />
          </label>
        ) : null}
        <label className="mt-3 block text-sm">
          <span className="text-muted-foreground">Weight multiplier</span>
          <input
            type="number"
            step="0.1"
            min={0}
            className="ui-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
            value={v.scoring.weight}
            onChange={(e) =>
              setV({
                ...v,
                scoring: {
                  ...v.scoring,
                  weight: Number(e.target.value),
                },
              })
            }
          />
        </label>
        {v.scoring.scoringMode !== "manual_points" ? (
          <>
            <p className="mt-3 text-xs text-muted-foreground">Points 1st → 6th</p>
            <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {v.scoring.placementPoints.map((p, i) => (
                <label key={i} className="text-xs">
                  #{i + 1}
                  <input
                    type="number"
                    className="ui-field mt-1 w-full rounded px-2 py-1 text-xs"
                    value={p}
                    onChange={(e) => setPoint(i, e.target.value)}
                  />
                </label>
              ))}
            </div>
          </>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">
            Placement row is unused for manual_points — scores are entered per
            team in Scoring.
          </p>
        )}
      </div>

      <label className="block text-sm">
        <span className="text-muted-foreground">Rules (markdown)</span>
        <textarea
          rows={8}
          className="ui-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
          value={v.rulesMarkdown}
          onChange={(e) => setV({ ...v, rulesMarkdown: e.target.value })}
        />
      </label>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={save}
          className="ui-button rounded-xl px-4 py-2 text-sm font-medium"
        >
          Save
        </button>
        {isEdit ? (
          <button
            type="button"
            onClick={remove}
            className="ui-button-accent rounded-xl px-4 py-2 text-sm"
          >
            Delete
          </button>
        ) : null}
      </div>
    </div>
  );
}
