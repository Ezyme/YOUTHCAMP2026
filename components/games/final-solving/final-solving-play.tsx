"use client";

import { useEffect, useMemo, useState } from "react";
import {
  KeyRound,
  Layers,
  Lock,
  Sparkles,
  Skull,
  ChevronRight,
} from "lucide-react";
import { showError, showSuccess } from "@/lib/ui/toast";

type Clue = {
  _id: string;
  text: string;
  sourceGameSlug: string;
  order: number;
};

const SUITS = ["♠", "♥", "♦", "♣"] as const;

function slugToLabel(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function FinalSolvingPlay({
  sessionId,
  teamId,
  teamName,
}: {
  sessionId: string;
  teamId: string;
  teamName?: string;
}) {
  const [clues, setClues] = useState<Clue[]>([]);
  const [answer, setAnswer] = useState("");
  const [msg, setMsg] = useState("");
  const [status, setStatus] = useState<"idle" | "success" | "fail">("idle");
  const [loading, setLoading] = useState(false);

  const sortedClues = useMemo(
    () => [...clues].sort((a, b) => a.order - b.order || 0),
    [clues],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(
        `/api/clues?sessionId=${sessionId}&teamId=${teamId}`,
      );
      const data = await res.json();
      if (!cancelled && Array.isArray(data)) setClues(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, teamId]);

  async function submit() {
    setMsg("");
    setLoading(true);
    setStatus("idle");
    try {
      const res = await fetch("/api/final-solving/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, teamId, answer }),
      });
      const data = await res.json();
      if (!res.ok) {
        const err = String(data.error ?? "Error");
        setMsg(err);
        setStatus("fail");
        showError(err);
        return;
      }
      if (data.ok) {
        setMsg("GAME CLEARED — answer accepted.");
        setStatus("success");
        showSuccess("Answer accepted — game cleared!");
      } else {
        setMsg("DENIED — synthesis incorrect. Re-read your fragments.");
        setStatus("fail");
        showError("Incorrect — re-read your fragments.");
      }
    } finally {
      setLoading(false);
    }
  }

  if (!sessionId || !teamId) {
    return (
      <p className="text-sm text-amber-600">
        Run seed, pick a team from /camp or add{" "}
        <code className="rounded bg-muted px-1 text-amber-900">?teamId=</code>{" "}
        to the URL.
      </p>
    );
  }

  return (
      <div
        className={[
          "relative overflow-hidden rounded-2xl border bg-gradient-to-b p-1 shadow-2xl",
          status === "success"
            ? "border-emerald-500/60 from-emerald-950/90 via-zinc-950 to-black shadow-emerald-900/40"
            : status === "fail"
              ? "border-accent/70 from-accent/20 via-muted to-card shadow-accent/30"
              : "border-primary/40 from-card via-muted to-card shadow-[0_0_80px_-20px_rgba(61,138,134,0.35)]",
        ].join(" ")}
      >
        {/* Ambient glow */}
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(61,138,134,0.18),_transparent_55%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_rgba(230,57,70,0.1),_transparent_50%)]"
          aria-hidden
        />

      <div className="relative rounded-xl bg-card/90 px-4 py-8 sm:px-8 sm:py-10">
        {/* Header */}
        <header className="text-center">
          <p className="font-mono text-[10px] tracking-[0.35em] text-accent/90 sm:text-xs">
            FINAL STAGE · CLUE SYNTHESIS
          </p>
          <h2 className="mt-3 flex items-center justify-center gap-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            <Skull className="size-7 text-accent sm:size-8" aria-hidden />
            <span className="bg-gradient-to-r from-amber-200 via-amber-50 to-amber-200 bg-clip-text text-transparent dark:from-amber-200 dark:via-amber-100 dark:to-amber-200">
              The last riddle
            </span>
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
            Every checkpoint left you a fragment. Piece them together — the
            border closes when your answer matches what the facilitators sealed
            away.
          </p>
          {teamName ? (
            <p className="mt-4 font-mono text-xs text-amber-200/80">
              <span className="text-muted-foreground">Operators</span> · {teamName}
            </p>
          ) : null}
        </header>

        {/* Clue deck */}
        <section className="mt-10">
          <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <Layers className="size-4 text-accent" />
            Collected fragments
            <span className="ml-auto font-mono text-[10px] normal-case text-muted-foreground">
              {sortedClues.length} / use all
            </span>
          </div>

          {sortedClues.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/40 px-4 py-8 text-center text-sm text-muted-foreground">
              <Lock className="mx-auto mb-2 size-8 text-muted-foreground" />
              No fragments recorded for your team yet. Facilitators add clues in
              Admin after each Amazing Race leg — check back, or confirm your
              team is correct.
            </div>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {sortedClues.map((c, i) => {
                const suit = SUITS[i % 4];
                const isRed = suit === "♥" || suit === "♦";
                return (
                  <li
                    key={c._id}
                    className="group relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-card to-muted p-4 shadow-lg transition hover:border-accent/40 hover:shadow-accent/10"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={`font-mono text-lg ${isRed ? "text-accent" : "text-muted-foreground"}`}
                        aria-hidden
                      >
                        {suit}
                      </span>
                      <span className="rounded bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                        {slugToLabel(c.sourceGameSlug)}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-foreground">
                      {c.text}
                    </p>
                    <div className="mt-3 flex items-center justify-between border-t border-border pt-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                      Fragment {String(i + 1).padStart(2, "0")}
                      <span className="text-accent/70">◇</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Puzzle chamber */}
        <section className="mt-12 rounded-2xl border border-border bg-gradient-to-b from-card to-muted p-5 sm:p-6">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary/80">
            <KeyRound className="size-4" />
            Seal your answer
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            One submission. Normalize spelling if your puzzle uses &quot;normalized&quot;
            validation — spaces and case may be folded.
          </p>
          <label className="mt-4 block">
            <span className="sr-only">Final answer</span>
            <textarea
              rows={3}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Type the synthesized answer…"
              className="ui-field w-full resize-y rounded-xl px-4 py-3 font-mono text-sm"
            />
          </label>
          <button
            type="button"
            disabled={loading || !answer.trim()}
            onClick={() => void submit()}
            className="ui-button group mt-5 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-bold uppercase tracking-widest disabled:opacity-40"
          >
            {loading ? (
              "Verifying…"
            ) : (
              <>
                <Sparkles className="size-4 text-amber-200" />
                Verify answer
                <ChevronRight className="size-4 transition group-hover:translate-x-0.5" />
              </>
            )}
          </button>

          {msg ? (
            <p
              role="status"
              className={
                status === "success"
                  ? "mt-4 text-center font-mono text-sm font-semibold text-emerald-600"
                  : status === "fail"
                    ? "mt-4 text-center font-mono text-sm text-accent"
                    : "mt-4 text-center text-sm text-muted-foreground"
              }
            >
              {msg}
            </p>
          ) : null}

          {status === "success" ? (
            <p className="mt-6 text-center text-xs text-muted-foreground">
              Report to facilitators — they can record your camp placement in
              Admin scoring.
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
