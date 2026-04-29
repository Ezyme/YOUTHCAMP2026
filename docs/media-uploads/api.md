# media-uploads — api

## `POST /api/cloudinary/upload`

[Source](../../app/api/cloudinary/upload/route.ts)

Upload one file to Cloudinary and receive `{ url, publicId }`.

### Auth: public (no admin check today; only the admin panel calls it).

### Request: `multipart/form-data`

Form fields:
- `file` — the file to upload (required, must be a `Blob`)
- `folder` — destination folder name (optional, default `"games"`); namespaced under `youthcamp/<folder>` on Cloudinary

### Responses

| Status | Body |
|---|---|
| 200 | `{ url: "https://res.cloudinary.com/...", publicId: "youthcamp/games/abc123" }` |
| 400 | `{ error: "file required" }` |
| 503 | `{ error: "Cloudinary is not configured" }` (missing env vars) |
| 500 | `{ error: "<Cloudinary error message>" }` |

### Side effects
- File uploaded to Cloudinary in folder `youthcamp/<folder>`.
- No DB write. The caller is responsible for storing `publicId` and `url` (typically into `GameDefinition.mediaUrl` / `mediaPublicId`).

### What this route does NOT do

- **Doesn't enforce size limits.** Cloudinary defaults apply (10MB image, 100MB video, etc.).
- **Doesn't validate MIME types.** `resource_type: "auto"` lets Cloudinary detect.
- **Doesn't authenticate the caller.** Anyone reaching the URL can upload — burning quota.
- **Doesn't return upload progress.** Single response, all-or-nothing.
