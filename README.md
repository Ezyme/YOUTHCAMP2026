# YouthCamp Games

Next.js (App Router) + Tailwind + MongoDB camp platform: dynamic game definitions, fair 1st–6th scoring, Mindgame grid planner, optional Cloudinary uploads.

## Setup

1. Copy [`.env.example`](.env.example) to `.env.local` and set `MONGODB_URI` (and optional `ADMIN_SECRET`, Cloudinary keys).
2. **Team logins** (after Admin **Seed**): usernames `team1` … `team6`, shared password from `TEAM_SEED_PASSWORD` (default `youthcamp`). Set `CAMP_REQUIRE_LOGIN=1` to require login for `/camp`. If the gate is **off**, the dashboard stays open without logging in (handy for local dev).
3. `npm install`
4. `npm run dev`
5. Open `/admin`, run **Seed**, then use **Scoring** as needed.
6. Teams use **`/camp`** for comeback stats and a link to the **shared Mindgame** board per group. **Amazing Race** is seeded with **2× weight** on the standard point row so it swings the camp more than a single small game.

## Deploy (Vercel)

Add the same env vars in the Vercel project. Use a dedicated MongoDB user and **rotate credentials** if they were ever exposed.

## Scripts

- `npm run dev` — development server
- `npm run build` — production build
- `npm run lint` — ESLint
- `npm run typecheck` — `tsc --noEmit`
