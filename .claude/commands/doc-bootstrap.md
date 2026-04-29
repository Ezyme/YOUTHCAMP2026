---
description: One-time documentation bootstrap. Generates docs/<domain>/ folders for every domain in the Domain Manifest.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# /doc-bootstrap — One-time codebase documentation pass

You are running a long, multi-commit documentation pass. Read this entire prompt before starting.

## What you are doing

Generate per-domain documentation folders under `docs/<domain>/` for every domain listed in the **Domain Manifest** (the JSON block in `CLAUDE.md` between `<!-- DOMAIN-MANIFEST-START -->` and `<!-- DOMAIN-MANIFEST-END -->`).

For each domain:
1. Read every source file matching the domain's `paths` globs.
2. Generate the standardized 8 base docs (always) plus 1 conditional doc (`models.md` if Mongoose models present — this repo's models all live in `lib/db/models.ts`, so only the `db` domain triggers this).
3. Update `lastVerified` in the manifest to today's ISO date.
4. **Stop and ask the user to review and commit before moving to the next domain.**

## The 8 + 1 doc template

For every domain, generate these files inside `docs/<domain>/`:

| File | Always | Content |
|---|---|---|
| `README.md` | yes | Index — one-liner per other doc, ownership, related domains, links |
| `architecture.md` | yes | Data flow, layers, key entities, sequence diagrams (mermaid optional), how this domain fits the broader app |
| `frontend.md` | yes | Pages, components, client state. Stub with `_N/A — this domain has no frontend surface. See [architecture.md](./architecture.md)._` if domain has zero UI. |
| `backend.md` | yes | `lib/` functions, business rules, server-only logic. Stub if N/A. |
| `api.md` | yes | Every route under this domain — method, path, auth, request/response shape, error codes. Stub if N/A. |
| `rules.md` | yes | Hard must / must-not constraints. Pull from CLAUDE.md, AGENTS.md, code comments, and your own discoveries. |
| `patterns.md` | yes | Recurring code conventions in this domain (naming, error shapes, validation patterns). |
| `gotchas.md` | yes | Past incidents, surprising behaviors, race conditions, "looks-buggy-but-isn't". Mine git log and code comments for these. |
| `models.md` | only for `db` domain (Mongoose schemas) | One section per schema in `lib/db/models.ts` — fields, indexes, relationships, hooks |

### Stub format for N/A files

```markdown
# frontend.md

_N/A — this domain has no frontend surface. See [architecture.md](./architecture.md)._
```

## Per-domain workflow

For each domain in the manifest, execute this loop:

1. **Read manifest entry** — paths, docs folder.
2. **Glob the source files** — every file matching the paths. Read them all.
3. **Determine which docs to create** — always 8, plus models.md only for the `db` domain (since all schemas live there).
4. **Generate each doc** — write factual, code-grounded content. Cite file paths for every claim. No invented "best practices" — only document what's actually there.
5. **Update the manifest** — set `lastVerified` for this domain to today's ISO date in the JSON block in CLAUDE.md.
6. **Stop and ask the user**: "Domain `<name>`: 8 (or 9) docs generated under `docs/<name>/`. Please review. Want to commit this domain?"
7. **Wait for explicit user approval** before running `git commit`. Use commit message: `docs(<domain>): bootstrap domain documentation`.
8. After commit (or after user says skip), move to next domain.

## After all domains are done

9. Generate `docs/README.md` — a top-level index with a table linking to all domain folders, brief one-liner per domain.
10. Stop and ask the user to review the final cleanup.

## Hard rules (overriding any other behavior)

- **No autonomous commits.** Every commit requires explicit user approval. The repo has a no-auto-commit hook; do not try to bypass it.
- **No invented content.** If you don't know something, write `_TODO: verify with the team._` rather than guess. Better an honest gap than a wrong claim.
- **One domain at a time.** Do not parallelize across domains. The user needs to review each one before the next.
- **Cite code locations.** Use `[filename.ts:42](lib/path/filename.ts#L42)` markdown links so the user can click through.
- **Respect AGENTS.md.** If documenting Next.js-specific behavior, verify it against `node_modules/next/dist/docs/` — Next.js 16 has breaking changes from training data.

## How to start

1. Read CLAUDE.md fully (especially the Domain Manifest).
2. List the domains and confirm with the user: "Bootstrap will generate docs across the manifest's domains, one commit per domain. Start in alphabetical order, or do you want to pick the order?"
3. Wait for user choice.
4. Execute the per-domain workflow.
