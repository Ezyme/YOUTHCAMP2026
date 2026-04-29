# admin — recipes

## Recipe: add a new admin panel page

1. Create a server component at `app/admin/(panel)/<feature>/page.tsx`.
2. `export const dynamic = "force-dynamic";` at the top.
3. Fetch the data you need (`dbConnect`, then model reads).
4. Strip Mongoose internals (`String(_id)`, `plainGameScoring`, etc.) before passing to client sub-components.
5. Add a sidebar link in [`app/admin/(panel)/layout.tsx`](../../app/admin/(panel)/layout.tsx) under `adminLinks`.

Example skeleton:

```tsx
import { dbConnect } from "@/lib/db/connect";
import { Session } from "@/lib/db/models";
import { MyClientPanel } from "@/components/admin/my-client-panel";

export const dynamic = "force-dynamic";

export default async function MyAdminPage() {
  await dbConnect();
  const session = await Session.findOne().sort({ createdAt: -1 });
  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground">My feature</h1>
      <MyClientPanel sessionId={session ? String(session._id) : ""} />
    </div>
  );
}
```

## Recipe: add a new admin API route

```ts
// app/api/admin/<feature>/route.ts
import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/admin-auth";
import { dbConnect } from "@/lib/db/connect";

export async function POST(req: Request) {
  try {
    if (!(await verifyAdminRequest())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    await dbConnect();
    const body = await req.json().catch(() => ({}));
    // ... validate, delegate to lib/, write
    return NextResponse.json({ ok: true /* + result */ });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

The auth check is the very first thing inside `try`. Don't dbConnect or parse body before it.

## Recipe: enforce admin auth on a public-namespaced route

If the threat model for an existing public-namespaced route (e.g. `/api/games`, `/api/teams`) tightens:

1. Add `verifyAdminRequest()` at the top of the handler. Return 403 on miss.
2. **Test the admin panel still works** — the panel uses these routes today. The cookie is already set when the user is on `/admin/...`, so the existing fetch calls should pass.
3. Verify no non-admin caller depends on the route. `Grep` for the route path and check every reference.

Don't fork into `/api/admin/<x>` unless the read shape also needs to change.

## Recipe: rotate `ADMIN_SECRET`

1. Generate a new long random string (e.g. `openssl rand -hex 32`).
2. Update `ADMIN_SECRET` in your env (production: platform secret store; dev: `.env.local`).
3. Restart the dev/prod server.
4. Existing `youthcamp_admin` cookies (containing the old secret) are now invalid. Admin will redirect to `/admin/login` on next page request and `verifyAdminRequest()` will return 403 for API calls.
5. Re-login at `/admin/login` with the new secret.

## Recipe: add a destructive admin action with confirm

Pattern from [`<ResetCampButton>`](../../components/admin/reset-camp-button.tsx):

```tsx
"use client";
import { useState } from "react";
import { showError, showSuccess } from "@/lib/ui/toast";

export function MyDestructiveButton() {
  const [busy, setBusy] = useState(false);
  async function go() {
    if (!confirm("Are you sure? This will …")) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/<endpoint>", { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      showSuccess("Done");
    } catch (e) {
      showError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }
  return <button onClick={go} disabled={busy} className="ui-button-danger">…</button>;
}
```

Browser `confirm()` is sufficient — match the existing UX.

## Recipe: add a new section to the admin sidebar

Edit [`app/admin/(panel)/layout.tsx`](../../app/admin/(panel)/layout.tsx) and add an entry to `adminLinks`:

```ts
const adminLinks = [
  // ...existing
  { href: "/admin/<feature>", label: "Feature label" },
];
```

The layout renders them in order. Sidebar on desktop, top nav on mobile (handled by Tailwind responsive classes).

## Recipe: extract the cookie name to a constant

(Improvement, not currently in code.) Today `"youthcamp_admin"` is hardcoded in four places. To consolidate:

1. Add to `lib/admin-auth.ts`: `export const ADMIN_COOKIE = "youthcamp_admin";`
2. Replace the literal in [`middleware.ts`](../../middleware.ts), [`/api/admin/login/route.ts`](../../app/api/admin/login/route.ts), and [`components/site-header.tsx`](../../components/site-header.tsx).
3. Verify lint + typecheck pass.

The reason this hasn't been done yet: middleware can't import `lib/admin-auth.ts` if that file imports `next/headers` (middleware runs in the Edge runtime). Currently `verifyAdminRequest` does import `next/headers`. Solution: put the constant in a separate file like `lib/admin-cookie.ts` that has no imports, then have both middleware and `admin-auth.ts` import from there.
