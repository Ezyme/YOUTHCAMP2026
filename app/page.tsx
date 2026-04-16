import Link from "next/link";
import { ArrowRight, Grid3x3, Trophy, Settings2, Shield, Sparkles } from "lucide-react";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-4 py-10 sm:px-6">
      <section className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-card to-muted px-6 py-10 shadow-sm">
        <div
          className="pointer-events-none absolute -right-16 -top-24 size-72 rotate-12 rounded-full bg-accent/15 dark:bg-accent/20"
          aria-hidden
        />
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          Identity Camp 2026
        </p>
        <h1 className="mt-2 text-4xl tracking-tight text-foreground sm:text-5xl">
          Discover who God says you are
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
          Play team games, compete on the leaderboard, and uncover the truth
          about your identity in Christ. Every challenge brings you closer to
          understanding who you were made to be.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link
            href="/games"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            Browse games
            <ArrowRight className="size-4" />
          </Link>
          <Link
            href="/leaderboard"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 py-3 text-sm font-medium text-card-foreground transition hover:bg-muted"
          >
            <Trophy className="size-4" />
            Leaderboard
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 py-3 text-sm font-medium text-card-foreground transition hover:bg-muted"
          >
            <Shield className="size-4" />
            Team Login
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5">
          <Sparkles className="size-8 text-accent" />
          <h2 className="mt-3 text-lg tracking-tight text-card-foreground">
            Unmasked
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Identity minefield — reveal truth tiles, avoid the lies, and
            assemble a hidden Bible verse about who you are in God.
          </p>
          <Link
            href="/play/unmasked"
            className="mt-4 inline-flex text-sm font-medium text-primary hover:underline"
          >
            Play now
          </Link>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <Grid3x3 className="size-8 text-primary" />
          <h2 className="mt-3 text-lg tracking-tight text-card-foreground">
            Mindgame
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Grid puzzle — move numbered pins through a maze to sort them in
            order. Plan ahead, every step counts.
          </p>
          <Link
            href="/play/mindgame"
            className="mt-4 inline-flex text-sm font-medium text-primary hover:underline"
          >
            Open play
          </Link>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <Settings2 className="size-8 text-primary" />
          <h2 className="mt-3 text-lg tracking-tight text-card-foreground">
            Final Solving
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The finale — combine clues earned through the Amazing Race and
            submit your answer to clear the final challenge.
          </p>
          <Link
            href="/play/final-solving"
            className="mt-4 inline-flex text-sm font-medium text-primary hover:underline"
          >
            Play finale
          </Link>
        </div>
      </section>
    </main>
  );
}
