# db — env

| Variable | Required | Used by | Notes |
|---|---|---|---|
| `MONGODB_URI` | **yes** | [lib/db/connect.ts](../../lib/db/connect.ts) | MongoDB connection string. Throws on first `dbConnect()` if unset. |
| `NODE_ENV` | implicit | [lib/db/models.ts](../../lib/db/models.ts) | Standard Next.js variable. The dev-HMR enum reset blocks (`UnmaskedState`, `PowerUpCode`) only run when this is `"development"`. |

## Setting `MONGODB_URI`

Local development:

```dotenv
# .env.local
MONGODB_URI=mongodb://localhost:27017/youthcamp
```

Production (Vercel / hosting): set `MONGODB_URI` in the platform's secret store. Use a connection string from MongoDB Atlas with database name embedded (e.g. `mongodb+srv://user:pw@cluster/youthcamp?retryWrites=true&w=majority`).

## What happens if `MONGODB_URI` is missing

The first call to `dbConnect()` throws:

```
Please define MONGODB_URI in .env.local (MongoDB connection string).
```

API routes catch this and return a 500. Pages will throw and render Next.js's error boundary.

## What does **not** belong in db env

- `ADMIN_SECRET` — admin auth, see [admin/env.md](../admin/env.md)
- `CAMP_LOGIN_PASSWORD`, `CAMP_REQUIRE_LOGIN` — camp gate, see [camp-auth/env.md](../camp-auth/env.md)
- `TEAM_SEED_PASSWORD` — seed, not db
- `CLOUDINARY_*` — see [media-uploads/env.md](../media-uploads/env.md)
