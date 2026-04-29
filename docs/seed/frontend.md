# seed — frontend

## `<SeedButton />` — [components/admin/seed-button.tsx](../../components/admin/seed-button.tsx)

Client. POSTs `/api/seed` with empty body. On success → success toast with the response message + team usernames. On failure → error toast.

The button is rendered on the admin dashboard `/admin` ([app/admin/(panel)/page.tsx](../../app/admin/(panel)/page.tsx)).

UX: a single click. No confirm dialog — seed is idempotent and harmless on already-seeded DBs. The response includes:
- `gamesUpserted` — count
- `sessionId`
- `teamLoginUsernames` — array of `team1` … `team6`
- `teamPasswordNote` — informational string

## `<ResetCampButton />` — [components/admin/reset-camp-button.tsx](../../components/admin/reset-camp-button.tsx)

Client. POSTs `/api/admin/reset-camp` after a `confirm()` dialog. On success → success toast with the deletion counts.

Lives in `components/admin/` (logically tied to admin) but conceptually it's the inverse of seed — wipes play state without re-seeding.

The page rendering both buttons is `/admin` ([app/admin/(panel)/page.tsx](../../app/admin/(panel)/page.tsx)) under "Bootstrap" and "Reset camp" cards.

## What this domain does NOT render

- A teams list — see [admin/frontend.md](../admin/frontend.md), `<TeamsClient>`.
- A games list — see [admin/frontend.md](../admin/frontend.md), `/admin/games`.
- A seed-config form — `CAMP_GAMES` is code-only. There's no admin UI for editing the seed list. To change games, edit `lib/seed/camp-games.ts` and re-deploy.
