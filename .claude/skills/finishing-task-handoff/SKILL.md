---
name: finishing-task-handoff
description: Use when implementation work is finished and you are about to tell the user it is done, before asking the user to commit, when wrapping up a feature/bugfix, or when about to run a verification pass. Triggers on phrases like "I'm done", "ready to commit", "all set", "wrap this up", "ship it", or before any "task complete" message.
---

# finishing-task-handoff

## When to use
Right before you would otherwise tell the user "done" / "ready" / "all set". Auto-commit is **hard-blocked** by `.claude/hooks/no-auto-commit.mjs`; this skill is the pre-handoff ritual that runs before you ask the user for the explicit `commit` / `push` / `merge` / `make a PR` keyword.

## Steps
1. **Lint.** `npm run lint`. If it errors, fix before continuing — do not hand off with lint failures.
2. **Type-check.** `npm run typecheck`. Same rule — fix before continuing.
3. **Manual verification.** This repo has **no test framework**. Pick the smallest reasonable manual check and run it:
   - Touched a route handler? Boot `npm run dev` and exercise it (browser or `curl`). Report the JSON shape.
   - Touched a `lib/games/<engine>/` engine? Open the matching page (`/play/<slug>`) and run one round end-to-end.
   - Touched `lib/scoring/`? Visit `/leaderboard` and confirm the breakdown still tallies.
   - Touched camp auth? Toggle `CAMP_REQUIRE_LOGIN` off and on; confirm `/camp` and `/play/*` gate as expected.
   - Touched admin? Hit `/admin` with and without the `youthcamp_admin` cookie / `ADMIN_SECRET` set.

   If you can't run a manual flow (env not set up, etc.), say so explicitly under **manual: skipped — <reason>**. Do not pretend to have tested.
4. **Manifest check.** Did you create any new files? Make sure each touched path is matched by a `paths` glob in the Domain Manifest in `CLAUDE.md`. If not, invoke `registering-new-domain`.
5. **Doc-sync.** For each touched `app/`, `components/`, `lib/`, `middleware.ts`, or `next.config.ts` file, the `docs/<domain>/` page must be updated. The Stop hook (`.claude/hooks/doc-sync.mjs`) will block otherwise — do this *before* declaring done so the hook passes silently.
6. **Hand off.** Tell the user (a) what changed, (b) what verifications passed, (c) ask explicitly: "Want me to commit this?" Wait for the keyword.

## Conventions
- **Never** run `git commit`, `git add`, `git push`, `gh pr create`, `gh pr merge`. The PreToolUse hook will reject it; even if it didn't, CLAUDE.md hard rule #1 forbids it.
- The user must use one of these keywords in their **most recent** message: `commit`, `push`, `merge`, `make a PR`, `create a PR`, `open a PR`, `ship it`. Anything else (including "looks good", "thanks") is **not** authorization.
- If lint/typecheck fail and you can't fix in one or two attempts, hand off the failure to the user with the exact error — do not declare done.
- There is no `removeConsole` config — `console.log` survives builds. If you added debug logging, either delete it or convert to `console.warn`/`error` if it's worth keeping.

## Verification
This skill is itself the verification step. The output of steps 1–3 IS the proof. End-of-turn message format:
```
- lint: ✓
- typecheck: ✓
- manual: <what you ran and what you observed>
- docs updated: <list>
Want me to commit this?
```
