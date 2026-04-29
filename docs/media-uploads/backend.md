# media-uploads — backend

## `lib/cloudinary.ts`

[Source](../../lib/cloudinary.ts). Two exports.

### `configureCloudinary(): void`

Reads `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` from env. If all three are present, calls `cloudinary.config({ ..., secure: true })`. If any is missing, returns silently — the SDK stays unconfigured.

Why silent: in local dev without Cloudinary keys, the app should still boot. Only the upload path fails (with a friendly 503).

### `uploadGameMedia(file, folder, publicId?): Promise<{ url, publicId }>`

1. Calls `configureCloudinary()` (idempotent).
2. Throws `Cloudinary is not configured` if `CLOUDINARY_CLOUD_NAME` is unset (sufficient marker — config returns silently when any of the three is missing).
3. Opens an `upload_stream` with options:
   - `folder: "youthcamp/<folder>"` (folder argument is namespaced under `youthcamp`)
   - `public_id` if provided (otherwise auto-generated)
   - `resource_type: "auto"` (handles image, video, raw)
4. `.end(file)` pipes the buffer into the stream.
5. Resolves with `{ url: result.secure_url, publicId: result.public_id }` on success.

The optional `publicId` parameter lets you re-upload to the same asset id (overwriting). The route doesn't expose this — every upload gets a fresh id from Cloudinary.

## Route — `POST /api/cloudinary/upload`

[Source](../../app/api/cloudinary/upload/route.ts). 30-line handler:

1. Verify all three env vars are set; 503 if not.
2. `req.formData()` — get the file blob and folder.
3. Validate `file instanceof Blob`; 400 if not.
4. `Buffer.from(await file.arrayBuffer())`.
5. `await uploadGameMedia(buf, folder)`.
6. Return `{ url, publicId }` 200.

## What's NOT here

- **Auth** — the route has no admin check. Today the admin panel is the only caller; an attacker who reaches `/api/cloudinary/upload` could burn the Cloudinary quota. See [rules.md](./rules.md) for hardening notes.
- **Size / type validation** — no file size cap, no MIME check. Cloudinary will reject overly-large files but you'll have spent CPU and bandwidth getting there.
- **Per-team uploads** — no team-bound flow.
- **Delete endpoint** — no DELETE route. To remove an asset, use Cloudinary's dashboard or write a new endpoint.
