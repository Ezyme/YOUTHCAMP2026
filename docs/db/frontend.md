# db — frontend

_N/A — `mongoose` is a **server-only** import. It must never appear in a Client Component (`"use client"` file)._

If you need a model's data in the browser, fetch it through an API route. See:

- [api.md](../scoring/api.md) for leaderboard data
- [api.md](../unmasked/api.md) for Unmasked state
- [api.md](../mindgame/api.md) for Mindgame state

If you need a model's **type** in a client component (e.g. `PowerUpType` for typing props), import the type alone — TypeScript erases it at compile time and Webpack will not bundle the model registry. The pattern in this codebase is:

```ts
"use client";
import type { PowerUpType } from "@/lib/db/models";
```

This is safe — only the `import type` statement, never `import { Team }`.
