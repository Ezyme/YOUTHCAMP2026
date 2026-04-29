# media-uploads — recipes

## Recipe: add a delete endpoint

Today there's no way to delete a Cloudinary asset from the app. To add one:

```ts
// app/api/cloudinary/delete/route.ts
import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { configureCloudinary } from "@/lib/cloudinary";
import { verifyAdminRequest } from "@/lib/admin-auth";

export async function POST(req: Request) {
  if (!(await verifyAdminRequest())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const { publicId } = await req.json();
  if (!publicId) return NextResponse.json({ error: "publicId required" }, { status: 400 });
  configureCloudinary();
  await cloudinary.uploader.destroy(publicId, { resource_type: "auto" });
  return NextResponse.json({ ok: true });
}
```

Then update `<GameForm>` to call this when a user picks a new file (delete the old `mediaPublicId`) or when the game is deleted.

Update [`/api/games/[id]/DELETE`](../../app/api/games/[id]/route.ts) to call this before removing the row, so deleting a game also cleans up its asset.

## Recipe: enforce admin auth on the upload route

Today public. To gate:

1. Add `import { verifyAdminRequest } from "@/lib/admin-auth";` to [upload route](../../app/api/cloudinary/upload/route.ts).
2. As the first line inside try:
   ```ts
   if (!(await verifyAdminRequest())) {
     return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
   }
   ```
3. Test that `<GameForm>` still works (the admin cookie travels with the fetch).

## Recipe: enforce file size / type

```ts
const MAX_BYTES = 10 * 1024 * 1024;  // 10MB
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "video/mp4"]);

if (file.size > MAX_BYTES) {
  return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 413 });
}
if (!ALLOWED.has(file.type)) {
  return NextResponse.json({ error: "Unsupported type" }, { status: 415 });
}
```

The `file.size` and `file.type` come from the `Blob` interface — both available before reading the buffer. Reject early.

## Recipe: change the Cloudinary folder

Edit the `<GameForm>` to pass a different `folder` form value. Or change the route's default in [upload route:18](../../app/api/cloudinary/upload/route.ts#L18) — the folder is namespaced under `youthcamp/` regardless.

For multi-environment setups, suffix the folder per env:

```ts
const folder = String(form.get("folder") ?? "games");
const envFolder = process.env.NODE_ENV === "production" ? folder : `${folder}-staging`;
```

## Recipe: rotate Cloudinary credentials

1. Generate new credentials in Cloudinary dashboard.
2. Update env vars in production secret store + redeploy.
3. Old uploads still work (their URLs aren't credential-bound).
4. Future uploads use the new keys.

There's no "live rotation" to coordinate — Cloudinary handles old + new keys both being valid for a transition window.

## Recipe: serve transformed URLs

Cloudinary supports URL-based transforms (`f_auto,q_auto,w_800` etc.). Today we save the canonical `secure_url` and use it as-is.

To add transforms on the client:

```ts
import { Cloudinary } from "@cloudinary/url-gen";
import { auto } from "@cloudinary/url-gen/qualifiers/format";

const cld = new Cloudinary({ cloud: { cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME } });
const url = cld.image(publicId).format(auto()).quality("auto").toURL();
```

Note: this requires exposing `CLOUDINARY_CLOUD_NAME` as a public env var (`NEXT_PUBLIC_*`) — it's not a secret. The API key + secret stay server-side.

## Recipe: support direct browser uploads (unsigned)

If the server-roundtrip is too slow, Cloudinary unsigned uploads via upload presets:

1. Create an upload preset in Cloudinary dashboard (set folder, allowed formats, size limits there).
2. Expose `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` and `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` as public env vars.
3. Browser uploads directly: `POST https://api.cloudinary.com/v1_1/<cloud>/auto/upload` with `upload_preset` form field.
4. Result is the canonical `secure_url`.

Trade-off: lose server-side admin auth. The preset's restrictions become your only enforcement.

## Recipe: track media usage

Cloudinary dashboard shows usage. To track in-app:

- Add a `mediaSize: number` field to `GameDefinition` and store the upload result's `bytes`.
- Aggregate in `getLeaderboard` or a new `/api/admin/media-usage` route.

Not currently in code; only useful if quota is a real concern.
