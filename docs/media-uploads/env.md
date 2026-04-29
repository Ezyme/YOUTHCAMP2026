# media-uploads — env

| Variable | Required | Effect |
|---|---|---|
| `CLOUDINARY_CLOUD_NAME` | for uploads | Identifies the Cloudinary cloud (e.g. `dxyz123`) |
| `CLOUDINARY_API_KEY` | for uploads | Public-ish API key |
| `CLOUDINARY_API_SECRET` | for uploads | **Server-only secret** |

All three must be set for uploads to work. If any is missing, the route returns 503 `Cloudinary is not configured`. The app boots fine without them — only the upload path fails gracefully.

## Setting them up

Sign up at [cloudinary.com](https://cloudinary.com). Free tier covers a typical camp.

Local dev:
```dotenv
# .env.local
CLOUDINARY_CLOUD_NAME=dxyz123
CLOUDINARY_API_KEY=987654321
CLOUDINARY_API_SECRET=abcdef-secret-here
```

Production: platform secret store (Vercel / Fly.io). Do not commit.

## Are these "public" or "secret"?

- `CLOUDINARY_CLOUD_NAME` — public. Appears in every asset URL (`res.cloudinary.com/<cloud_name>/...`).
- `CLOUDINARY_API_KEY` — semi-public. Cloudinary docs say it's safe to expose for unsigned uploads. We keep it server-side anyway because we don't use unsigned uploads.
- `CLOUDINARY_API_SECRET` — **never expose**. Anyone with this can issue signed API calls (delete, transform, list) on your account.

## What does NOT belong here

- `MONGODB_URI` — see [db/env.md](../db/env.md)
- `ADMIN_SECRET` — see [admin/env.md](../admin/env.md)
- Camp gate vars — see [camp-auth/env.md](../camp-auth/env.md)
