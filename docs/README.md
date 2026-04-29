# YouthCamp 2026 — Documentation

This directory documents the Next.js 16 / MongoDB / React 19 camp game platform. One folder per **domain** — a logical feature area defined in the `Domain Manifest` block of [CLAUDE.md](../CLAUDE.md).

## Domain index

| Domain | What it owns | One-liner |
|---|---|---|
| [db](./db/README.md) | Mongoose schemas + connection | The persistence layer; all schemas in one file |
| [camp-auth](./camp-auth/README.md) | Team login (`team1`…`team6`) + camp gate | Two cookies, optional gate, bcrypt-hashed team passwords |
| [admin](./admin/README.md) | Admin panel + secret auth | Single shared `ADMIN_SECRET`; per-handler cookie checks |
| [games-shared](./games-shared/README.md) | Engine registry, public game CRUD, /play dispatch | The seam between the two engines and `config_only` games |
| [mindgame](./mindgame/README.md) | Lattice walk puzzle (10×3 grid) | Pure engine + thin shell; no scoring (weight: 0) |
| [unmasked](./unmasked/README.md) | Identity Minefield + verse assembly | Server-authoritative; 9 power-up types, 16 Scripture passages |
| [scoring](./scoring/README.md) | /100 rubric, leaderboard, comeback math | Stored points are weighted at write time |
| [seed](./seed/README.md) | Bootstrap data + admin Seed button | Idempotent, slug-keyed; password rotates via env |
| [teams](./teams/README.md) | `/api/teams` CRUD | Public-namespaced (no auth check today) |
| [media-uploads](./media-uploads/README.md) | Cloudinary signed uploads | Server-side only; API secret never exposed |
| [analytics](./analytics/README.md) | Comeback analytics + public session info | Two thin read-only routes |
| [shared-ui](./shared-ui/README.md) | Layout, header, theme, toasts | One toast system, server-component header |
| [infrastructure](./infrastructure/README.md) | Middleware, build configs | Edge-runtime gating for `/admin`, `/camp`, `/play` |

## Cross-cutting references

- **[glossary.md](./glossary.md)** — domain terminology (placement, weight, comeback, given-up, masked passage, redemption code, etc.).
- **[CLAUDE.md](../CLAUDE.md)** — project-wide rules (no auto-commit, doc-sync, manifest format).
- **[AGENTS.md](../AGENTS.md)** — note about Next.js 16 having breaking changes from training data.

## Standard 8 + extras

Every domain has these 8 base files (or stubs):
- `README.md` — index of the folder
- `architecture.md` — data flow, layers, key entities
- `frontend.md` — pages and components (or N/A stub)
- `backend.md` — `lib/` functions and server-side logic (or N/A stub)
- `api.md` — routes (or N/A stub)
- `rules.md` — must / must-not constraints
- `patterns.md` — recurring code conventions
- `gotchas.md` — past incidents, surprising behaviors

Plus these conditional extras where they pay off:

| Extra | Where you'll find it |
|---|---|
| `models.md` | db, camp-auth, admin, mindgame, unmasked, scoring, analytics |
| `recipes.md` | db, camp-auth, admin, games-shared, mindgame, unmasked, scoring, seed, infrastructure, media-uploads |
| `env.md` | db, camp-auth, admin, media-uploads, infrastructure |
| `flows.md` | camp-auth, games-shared, mindgame, unmasked, scoring |

## How these docs are kept current

A `Stop` hook (`.claude/hooks/doc-sync.mjs`) verifies that any change to source files under `app/`, `components/`, `lib/`, or top-level config files is accompanied by a docs update under the matching domain folder. The Domain Manifest in [CLAUDE.md](../CLAUDE.md) is the file→domain map.

When in doubt, run `/doc-sync` (manual audit) or `/doc-domain <name>` (refresh one domain).
