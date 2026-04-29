# admin — patterns

## 1. Server pages, client sub-components

Every panel page is a server component that:
1. `await dbConnect()`.
2. Fetches the data it needs.
3. Strips Mongoose internals (`String(_id)`, `plainGameScoring`, etc.).
4. Renders a client sub-component with the cleaned data as props.

Why: server fetch is fast (single round-trip, no client JS), and the sub-component handles interactivity. Don't fetch from a panel page's client component on mount when you can pass it as a prop.

Example: [`/admin/scoring/page.tsx`](../../app/admin/(panel)/scoring/page.tsx) loads session/teams/games then passes them to `<ScoringPanel />`.

## 2. `dynamic = "force-dynamic"` on every panel page

```ts
export const dynamic = "force-dynamic";
```

Required because admin needs live state. Without it, Next.js may statically optimize the page and serve stale data.

## 3. `verifyAdminRequest()` early-return at the top of every admin handler

```ts
export async function POST() {
  if (!(await verifyAdminRequest())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  // ...
}
```

First line of the try block. Don't sandwich it between other work.

## 4. Reset / mutation routes use existing engine helpers

Admin routes for Unmasked (`/api/admin/unmasked/reset`, `/api/admin/unmasked/power-up-grant-all`) call into [`lib/games/unmasked/`](../../lib/games/unmasked/) helpers (`resetUnmaskedBoardKeepTimer`, `buildUnmaskedGrantUpdateForPowerUp`, `migrateLegacyUnmaskedState`). The admin handler is a thin auth + parse + delegate layer.

This is the same pattern the camp routes use — admin doesn't get a parallel mutation surface.

## 5. Public-namespaced mutation routes used by admin

`/api/games`, `/api/teams`, `/api/game-results`, `/api/unmasked/codes` are public-namespaced and used directly by the admin panel. There is no admin-only equivalent today.

When extending the panel:
- If the route is **read-only and non-sensitive** (e.g. listing teams), public-namespaced is fine.
- If the route **mutates and the threat model gets stricter**, add `verifyAdminRequest()` to the existing route. Don't fork into `/api/admin/...` unless the auth model genuinely differs.

## 6. `plainGameScoring` for serialization

Client components can't accept Mongoose subdocs as props (the `_id` buffer breaks React's structured-clone serialization). Anything that crosses the server→client boundary must be a plain object.

```ts
const initial = {
  ...stripMongooseInternals(g),
  scoring: plainGameScoring(g.scoring),
};
```

There's currently only `plainGameScoring` because `scoring` is the only embedded subdoc that crosses the boundary. If you add another embedded shape, write a parallel `plainXxx` helper in [`lib/admin/`](../../lib/admin/).

## 7. The `(panel)` route group for shared layout

Pages that need the sidebar live under `app/admin/(panel)/`. Pages that don't (login) live as siblings.

Never add a `(panel)`-style nested layout for one-off styling. Use page-level styling instead.

## 8. Toasts via `lib/ui/toast.ts`

Every admin form / panel uses `showError` / `showSuccess` from [`lib/ui/toast.ts`](../../lib/ui/toast.ts). Single-slot toasts, no duplicates. Don't add `sonner` toasts directly; go through these helpers so the IDs match across the app.
