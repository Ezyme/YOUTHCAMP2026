# media-uploads — frontend

The only caller is [`<GameForm>` in components/admin/game-form.tsx](../../components/admin/game-form.tsx). It exposes a file input. On change:

1. Builds a `FormData` with the file and `folder: "games"`.
2. POSTs to `/api/cloudinary/upload`.
3. On success, sets local state's `mediaUrl` and `mediaPublicId` from the response.
4. Form submit writes the saved game definition with those fields.

There is no progress UI today — the upload is opaque. For typical game art (under 5MB), this is fine on a fast connection.

If a previous upload exists when the user picks a new file, the old `mediaPublicId` is **overwritten in form state but not deleted from Cloudinary**. The orphan asset remains on the CDN. See [gotchas.md](./gotchas.md).

No public-facing UI consumes this domain directly. Game pages render `mediaUrl` via `<img>` / `<video>` tags wherever applicable.
