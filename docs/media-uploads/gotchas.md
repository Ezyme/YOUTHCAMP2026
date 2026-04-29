# media-uploads — gotchas

## 1. All three env vars required — silent failure if any missing

`configureCloudinary` returns silently if any of `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` is missing. The SDK stays unconfigured. The next upload throws `Cloudinary is not configured`.

In dev, this is a feature (you can run without keys). In prod, a typo'd env var name fails at first upload — not at boot. Add a startup check if this concerns you.

## 2. Game delete doesn't clean up the Cloudinary asset

`DELETE /api/games/[id]` removes the row but leaves `mediaUrl` / `mediaPublicId` orphaned in Cloudinary. Asset accumulates over time. Quota burn risk for long-running deployments.

To fix: write a `/api/cloudinary/delete` route ([recipes.md](./recipes.md#recipe-add-a-delete-endpoint)) and call it from the game delete handler.

## 3. Re-uploading a game's media orphans the previous asset

`<GameForm>` overwrites `mediaPublicId` in form state on a new upload. The old Cloudinary asset stays. Same accumulation problem as #2.

To fix: delete the old asset before uploading the new one. Or accept the orphan.

## 4. Public route — quota burn is a real risk

`/api/cloudinary/upload` has no auth. An attacker with the URL can flood Cloudinary with files. The free tier has a 25 credits/month cap; abuse exhausts it fast.

In a public-facing deployment, gate this behind `verifyAdminRequest()`. See [recipes.md](./recipes.md#recipe-enforce-admin-auth-on-the-upload-route).

## 5. No size / type validation

The route accepts any file size and any MIME type. Cloudinary will reject huge files but you've already paid the bandwidth + CPU. A malicious caller could send 100MB JSON dumps and waste server time.

Add a size cap in the route ([recipes.md](./recipes.md#recipe-enforce-file-size--type)).

## 6. Synchronous response, no progress

The fetch from `<GameForm>` to `/api/cloudinary/upload` is single-shot. The user sees the form locked until the upload completes. For a 5MB file on slow connections, this could be 10+ seconds.

To improve: switch to an unsigned direct-upload preset (loses server-side gating) or implement chunked upload with progress. Not currently in code.

## 7. `secure_url` returned, never the http variant

Cloudinary's `result.secure_url` is HTTPS. `result.url` would be HTTP. We use `secure_url` to avoid mixed-content warnings. Don't accidentally switch.

## 8. `resource_type: "auto"` requires correct file content

If a user renames a `.txt` to `.png` and uploads, Cloudinary reads the magic bytes — sees text — and stores as `raw`. The returned `secure_url` would be a `.txt` URL. The app would happily save it to `mediaUrl` and `<img src=...>` would 404 (or render the text as a broken image).

Defensive frontend: filter accepted file types via `<input type="file" accept="image/*,video/*">`. Not currently enforced.

## 9. `publicId` includes the folder prefix

`result.public_id` is something like `youthcamp/games/abc123def456`. It includes the folder. Don't manually prepend `youthcamp/` again when calling `cloudinary.uploader.destroy(publicId)` — the API expects the full path as returned.

## 10. Cloudinary URL changes if the cloud name changes

If you rotate to a different Cloudinary account, all existing `mediaUrl` strings in the DB point to the old cloud. They keep working only as long as the old account exists. To migrate fully:

1. Download all assets from the old cloud.
2. Re-upload to the new cloud.
3. Update each `GameDefinition.mediaUrl` and `mediaPublicId` to the new ones.

Not a workflow we have a recipe for. Consider before rotating cloud accounts mid-deployment.

## 11. The `Buffer.from(await file.arrayBuffer())` allocates the whole file in memory

For a 100MB video, this allocates 100MB of RAM in the Next.js server process. Node's serverless runtime (Vercel) has memory limits (1GB on Hobby, 3GB on Pro). Above ~500MB you risk OOM.

If you need very large uploads, switch to streaming (don't buffer the whole file). The Cloudinary SDK accepts streams natively. Not currently in code.
