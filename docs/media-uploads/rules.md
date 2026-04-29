# media-uploads — rules

## MUST

- **The Cloudinary API secret stays server-side.** Never include `CLOUDINARY_API_SECRET` in any client component, public API response, or HTML output.
- **Always check all three env vars** (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`) before attempting an upload. The route returns 503 if any is missing.
- **Always namespace under `youthcamp/<folder>`** on Cloudinary. Don't write directly to the cloud root — that mixes assets with other apps.
- **Always store both `mediaUrl` and `mediaPublicId`** on `GameDefinition`. The publicId is required to delete or transform.
- **Use `resource_type: "auto"`** so Cloudinary detects image vs video vs raw. Don't hardcode `"image"`.

## MUST NOT

- **Never expose `/api/cloudinary/upload` without thinking about quota burn.** Today it's open. An attacker can flood Cloudinary with files and exhaust the plan. Add `verifyAdminRequest()` if quota concerns spike. See [recipes.md](./recipes.md).
- **Never bypass `configureCloudinary()`** — calling `cloudinary.uploader.upload_stream` directly without setting credentials silently fails or hits Cloudinary's defaults (which won't match this app's account).
- **Never store the API secret in `next.config.ts`, `.env.local` checked into git, or any client-readable file.** It must come from the deployment platform's secret store in production.
- **Never log Cloudinary responses verbatim.** They include the `secure_url` and `public_id` (fine), but errors might include diagnostic info — sanitize.
- **Never delete an existing Cloudinary asset without `mediaPublicId`.** The URL alone isn't a stable handle.
- **Never overwrite `mediaPublicId` in form state** without first deleting the previous asset (or accepting the orphan). Today the form orphans — see [gotchas.md](./gotchas.md).
