---
description: Manual audit — walks app/, components/, lib/, and root config files to verify every file matches exactly one domain in the Domain Manifest. Reports orphans (files no domain covers) and ghosts (manifest paths pointing to deleted files). Optional companion to the automatic Stop hook.
allowed-tools: Read, Glob, Bash
---

# /doc-sync — Manual codebase coverage audit

You are running a one-shot audit. No file edits, no commits — just a report.

## What you are checking

The Domain Manifest in `CLAUDE.md` claims to map every source file to exactly one domain. This audit verifies that claim against reality.

## Step 1: Read the manifest

Extract the JSON block from `CLAUDE.md` between `<!-- DOMAIN-MANIFEST-START -->` and `<!-- DOMAIN-MANIFEST-END -->`. Parse it.

## Step 2: List all source files

Use the Glob tool with patterns:
- `app/**/*.{ts,tsx}`
- `components/**/*.{ts,tsx}`
- `lib/**/*.{ts,tsx}`
- `middleware.ts`
- `next.config.ts`
- `eslint.config.mjs`
- `postcss.config.mjs`

Exclude `node_modules/`, `.next/`, `dist/`, `coverage/`, `.git/`.

## Step 3: For each file, find its owning domain

Use the matching logic in `.claude/hooks/lib/match.mjs` (path globs: `**` = any depth, `*` = single segment, `{a,b}` = alternatives).

Categorize:
- **Owned (1 domain match)** — happy path, no report needed.
- **Orphan (0 domain matches)** — file exists but no manifest entry covers it.
- **Conflict (2+ domain matches)** — manifest violation; should never happen.

## Step 4: Check for ghost manifest entries

For each `paths` glob in the manifest, glob the filesystem. If the glob matches zero files, the entry is a "ghost" (likely points to deleted/renamed code).

## Step 5: Report

Output a concise report. No editing.

Format:
```
# Doc-Sync Audit Report — <today>

## Coverage
- Total source files: <N>
- Owned by a domain: <N> (<%>)
- Orphans: <N>
- Conflicts: <N>

## Orphans
- <path>
- ...

For each orphan, suggest a domain to assign it to (based on file path/name heuristics).

## Conflicts
(none)

## Ghost manifest entries
- `<domain>` → `<path-glob>` (no files match)

## Recommendations
1. Assign orphans to domains by editing CLAUDE.md.
2. Remove ghost entries (or fix renames).
3. After fixes, run `/doc-sync` again to confirm clean.
```

## Hard rules

- **Read-only.** Do not edit any files. Do not commit. Just report.
- **No false alarms.** Verify your glob excludes `node_modules/`, `.next/`, `dist/`, `coverage/`, `.git/`.
- **Cite paths.** Every orphan and ghost should include the full path so the user can click through.
