# Unmasked: Game rules — Markdown rendering + content rewrite

**Date:** 2026-04-29
**Scope:** Rendering at `app/games/[slug]/page.tsx` + rules content at `lib/seed/camp-games.ts`. Adds two npm dependencies + one Tailwind plugin.
**Out of scope:** rule-editor UX in the admin panel, the rules preview at `app/play/[gameSlug]/page.tsx` (which only shows the first 200 chars and is left as plain text), the verse-tile fade and builder DnD (separate specs).

## Problem

The model field is named `rulesMarkdown`, the seed text uses Markdown syntax (`**Identity Minefield**`, …), and the game page wraps it in `<article className="prose prose-zinc">`. But the renderer at [app/games/[slug]/page.tsx:81-87](../../../app/games/[slug]/page.tsx#L81-L87) outputs the raw string inside a `<pre>` with `whitespace-pre-wrap`. Result:

- Markdown syntax renders as literal text — players see `**Identity Minefield**` with the asterisks.
- The `<pre>` forces a monospace + preserved whitespace look that clashes with the body type.
- The `prose` class on the parent is dead weight without the typography plugin.

Separately, the Identity Minefield rules ([lib/seed/camp-games.ts:173](../../../lib/seed/camp-games.ts#L173)) are one ~80-word run-on paragraph that mixes the goal, controls, scoring penalty, and power-up list. Players reading it in-game struggle to find the actionable parts.

## Goal

1. Render `rulesMarkdown` as actual Markdown — bold, lists, paragraph breaks all show correctly.
2. Rewrite the Identity Minefield rules into a structured, scannable Markdown block.
3. Both changes ship together so the new copy renders correctly the moment it goes live.

## Non-goals

- Rewriting OTHER games' rules (Flag, Camper's Night, etc.) in `lib/seed/camp-games.ts`. Only Identity Minefield this round.
- Sanitizing arbitrary user-authored Markdown — rules come from a checked-in seed file, not user input.
- Supporting raw HTML inside Markdown (we'll keep `react-markdown`'s defaults, which strip HTML for safety).

## Library choices

```
react-markdown        ~10 KB gzip — Markdown → React tree, no DOM bloat
remark-gfm            ~6 KB gzip — GitHub-flavored extras (lists, strikethrough, tables)
@tailwindcss/typography  ~5 KB CSS — powers the existing `prose` classes
```

Total runtime cost: ~16 KB gzip on the rules page. Acceptable for a static-ish page that's loaded infrequently.

## Design

### Step 1 — Install dependencies

```bash
npm install react-markdown remark-gfm
npm install -D @tailwindcss/typography
```

### Step 2 — Wire the typography plugin

In `app/globals.css`, immediately under the existing `@import "tailwindcss";` directive, add:

```css
@plugin "@tailwindcss/typography";
```

(Tailwind 4 syntax — plugins load via the CSS `@plugin` directive, not `tailwind.config.ts`.)

This activates the `prose` family of utility classes already present at the call site.

### Step 3 — Replace the renderer

In `app/games/[slug]/page.tsx`, find:

```tsx
{g.rulesMarkdown ? (
  <article className="prose prose-zinc mt-6 max-w-none text-sm dark:prose-invert">
    <pre className="whitespace-pre-wrap rounded-xl bg-muted p-4 font-sans text-foreground">
      {g.rulesMarkdown}
    </pre>
  </article>
) : null}
```

Replace with:

```tsx
{g.rulesMarkdown ? (
  <article className="prose prose-zinc mt-6 max-w-none rounded-xl bg-muted p-4 text-sm dark:prose-invert">
    <ReactMarkdown remarkPlugins={[remarkGfm]}>
      {g.rulesMarkdown}
    </ReactMarkdown>
  </article>
) : null}
```

The `<pre>` is gone. The card-like background (`bg-muted rounded-xl p-4`) moves to the `<article>` so the rules card visually matches the surrounding layout. Tailwind's `prose` plugin handles all internal element styling (h1/h2/h3, p, ul, ol, strong, em, code, blockquote, a).

Add the imports near the top of the file:

```tsx
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
```

### Step 4 — Rewrite the rules

In `lib/seed/camp-games.ts`, locate the `rulesMarkdown` field for the Identity Minefield game (around line 172-173). Replace with:

```ts
    rulesMarkdown: `**Identity Minefield**

Reveal every safe tile on the 20×20 board (~28% lies on Intense). Tap to reveal, long-press to flag a suspected lie.

Once the board is cleared:
- Drag fragments from the **Stack** into the **Builder row** in reading order.
- Tap **Check passage** to score. Each wrong check adds 30 s to your time and reveals a citation clue.

**Amazing Race codes** unlock Abundant Grace, Glimmer of Hope, Prophetic Vision, Armor of Truth, Divine Blueprint, Light of Discernment, Exposing the Dark, Living Word, and Steadfast Path.`,
```

(~70 words, four paragraph blocks: title, reveal mechanic, builder mechanic, code unlocks. Backtick template-literal lets us keep the line breaks readable in the source.)

The `**Drag fragments...**` phrasing assumes the verse-builder DnD change ships in the same release. If the DnD spec gets delayed, we keep the wording — the player still sees the up/down chevrons and can interpret "drag" loosely. Acceptable tolerance.

### Step 5 — Re-seed

The rules persist in MongoDB; the seed file is the source of truth. After this change deploys:

1. Admin clicks the **Seed** button on the admin panel (POSTs `app/api/seed/route.ts`).
2. The `Game` document for `unmasked` updates its `rulesMarkdown` field.
3. The next render of `/games/unmasked` shows the new copy.

Until that admin action runs, players continue to see the OLD rules from the DB. **The plan must call this out so the user runs Seed after merging.** No automatic re-seed on deploy.

The shorter-rules preview at [app/play/[gameSlug]/page.tsx:61-62](../../../app/play/[gameSlug]/page.tsx#L61-L62) — which slices `rulesMarkdown` to 200 characters and renders as plain text — will show `**Identity Minefield** — Reveal every safe tile on the 20×20…` literally. Acceptable for v1: that 200-char teaser is a quick-look on the play landing page; full rules live on the dedicated rules page. We can polish it in a follow-up if it bothers anyone.

## Edge cases

| Case | Behavior |
|---|---|
| `rulesMarkdown` empty / null | Existing guard `{g.rulesMarkdown ? ... : null}` short-circuits. ✓ |
| `rulesMarkdown` contains tables / links / code blocks | `remark-gfm` enables tables, strikethrough, autolinks. `prose` styles them. ✓ |
| `rulesMarkdown` contains raw HTML | `react-markdown` strips HTML by default — safe. We do NOT enable `rehype-raw`. ✓ |
| Player loads the page before the admin re-seeds | Sees old rules with literal `**` — only briefly. The render layer is already correct, only the DB content lags. ✓ |
| Tailwind 4 doesn't pick up the typography plugin | Verify at build time. If `prose` styles don't apply, the plugin install or `@plugin` directive is wrong. Build-blocker; fix before merge. |

## Verification

No test runner. Run after each step:

```bash
npm run lint
npm run typecheck
npm run dev   # then open /games/unmasked
```

Checks:
1. `/games/unmasked` shows **Identity Minefield** in bold (not literal `**`).
2. The bullet list under "Once the board is cleared:" renders as actual bullets.
3. The card background (`bg-muted`) wraps the rendered prose with rounded corners, no `<pre>` look.
4. Admin → Seed (the existing button) — the DB now has the new `rulesMarkdown`.
5. Reload `/games/unmasked` — same rendering, served from the updated DB.
6. Run `prose-zinc` styling under dark mode (toggle theme) — text contrast is acceptable.

## Files touched

| File | Change |
|---|---|
| `app/games/[slug]/page.tsx` | Replace `<pre>` with `<ReactMarkdown>`; move card classes to `<article>`; add imports |
| `lib/seed/camp-games.ts` | Rewrite Identity Minefield `rulesMarkdown` |
| `app/globals.css` | Add `@plugin "@tailwindcss/typography";` directive |
| `package.json` + `package-lock.json` | Three new entries (two runtime, one dev) |
| `docs/games-shared/` (if rules rendering is mentioned there) | Update reference |

## Risks

- **Plugin compatibility with Tailwind 4** — `@tailwindcss/typography` v0.5+ supports Tailwind 4 via the new `@plugin` directive. If the build fails after install, check the plugin version. Fall-back: revert the import and rely on minimal manual styling via `react-markdown`'s `components` prop.
- **`<pre>` removal changes layout** — the rounded card now sits at the `<article>` level. If the visual proportions look off in browser, add back `text-foreground` or adjust padding. Verify in `npm run dev`.
- **GitHub-flavored Markdown side effects** — `remark-gfm` is conservative; the only behaviors that bite are auto-linking URLs (probably fine for in-game rules) and table/strikethrough support (we don't use these). No regressions expected.

## Rollback

Single-commit revert. The three deps remain installed (no runtime damage).
