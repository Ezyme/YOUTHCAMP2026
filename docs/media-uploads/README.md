# media-uploads — Cloudinary game media

Server-side signed Cloudinary uploads for game media (images/videos shown on `/games/[slug]`). The Cloudinary credentials never leave the server.

## What lives in this folder

- [lib/cloudinary.ts](../../lib/cloudinary.ts) — `configureCloudinary()`, `uploadGameMedia()`.
- [app/api/cloudinary/upload/route.ts](../../app/api/cloudinary/upload/route.ts) — POST upload endpoint.

## Docs in this folder

| File | What it covers |
|---|---|
| [architecture.md](./architecture.md) | Server-signed upload via SDK, no client direct upload |
| [frontend.md](./frontend.md) | `<GameForm>` calls the route on file pick |
| [backend.md](./backend.md) | `configureCloudinary`, `uploadGameMedia` semantics |
| [api.md](./api.md) | `POST /api/cloudinary/upload` |
| [rules.md](./rules.md) | Never expose API secret, always check env vars |
| [patterns.md](./patterns.md) | Buffer upload via `upload_stream`, folder namespacing |
| [recipes.md](./recipes.md) | Add a delete endpoint, change folder, rotate credentials |
| [env.md](./env.md) | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` |
| [gotchas.md](./gotchas.md) | All-three-required, no progress reporting, no delete on game delete |

## Related domains

- [admin](../admin/README.md) — `<GameForm>` is the only caller.
- [games-shared](../games-shared/README.md) — `GameDefinition.mediaUrl` and `mediaPublicId` store the result.
