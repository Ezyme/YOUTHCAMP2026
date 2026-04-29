# media-uploads — architecture

## Server-signed uploads only

The Cloudinary API secret is **server-only**. The browser never sees it. Uploads flow:

1. Browser sends a `multipart/form-data` POST to `/api/cloudinary/upload` with the file blob.
2. Route reads the file into a Buffer and calls `uploadGameMedia(buffer, folder)`.
3. `uploadGameMedia` opens a Cloudinary `upload_stream`, pipes the buffer, and resolves with `{ url, publicId }`.
4. Browser receives the result and stores `url` + `publicId` in the game form's local state.
5. Form submit (`POST /api/games` or `PATCH /api/games/[id]`) writes `mediaUrl` and `mediaPublicId` to the `GameDefinition`.

There is **no signed-URL flow** that would let the browser upload directly to Cloudinary. All media transits the Next.js server. Trade-off: extra hop, but credentials stay private and the upload route can enforce rules (size limits, type checks) if needed (currently it doesn't).

## Folder namespacing

Every upload goes to `youthcamp/<folder>` where `<folder>` is the form value (defaults to `"games"`). Cloudinary's folder is a flat-namespace device — useful for organizing the asset library and for cross-environment cleanups.

`<GameForm>` always passes `folder: "games"`. Future flows could pass `folder: "teams"` etc.

## Cloudinary configuration

`configureCloudinary()` ([lib/cloudinary.ts:3-11](../../lib/cloudinary.ts#L3-L11)) reads three env vars:

```
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
```

If any is missing, the function returns silently — but `uploadGameMedia` then throws `Cloudinary is not configured` with a 503 from the route. This is intentional — local dev without Cloudinary keys can run the app, and only the upload path fails gracefully.

## Failure modes

- **Missing env vars**: Route returns 503 `Cloudinary is not configured`. Game form shows error toast.
- **No file**: 400 `file required`.
- **Cloudinary API error**: 500 with the error message.
- **Network timeout**: Default Cloudinary timeout (60s); the upload stream rejects.

## What this domain does NOT do

- **Delete** — there is no `/api/cloudinary/delete` endpoint. When a game is deleted from the admin panel, its Cloudinary asset stays. See [gotchas.md](./gotchas.md).
- **Resize / transform** — the URL returned by Cloudinary is `secure_url`, the canonical version. Transformations (e.g. crop, format) would need the `mediaPublicId` and a Cloudinary URL builder; not currently in code.
- **Direct file URL fetching** — admin forms upload files; they don't reference external URLs. If you wanted a "use existing Cloudinary asset" flow, you'd add a separate route.
- **Per-team media** — uploads are admin-only; no per-team uploaded content (no team avatars, etc.).

## Layer position

```
[Browser] <GameForm> file input
  → POST /api/cloudinary/upload (multipart/form-data)
        │
        ▼
  [app/api/cloudinary/upload/route.ts]
  parses formData, requires CLOUDINARY_* env vars
        │
        ▼
  [lib/cloudinary.ts]
  configureCloudinary + uploadGameMedia (upload_stream)
        │
        ▼
  Cloudinary CDN ──→ returns { url, publicId }
        │
        ▼
  Response → <GameForm> updates local state
        │
        ▼
  Form submit → POST /api/games or PATCH /api/games/[id]
        │
        ▼
  GameDefinition.mediaUrl + mediaPublicId saved
```
