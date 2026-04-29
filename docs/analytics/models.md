# analytics — models

_N/A — this domain owns no schemas._

It reads:
- `Session` — for the latest active session
- `Team` — for the per-session roster
- `GameDefinition` (via `getComebackAnalytics`)
- `GameResult` (via `getComebackAnalytics`)

All four are documented in [db/models.md](../db/models.md). The shapes returned by these routes are response-only — see [api.md](./api.md).
