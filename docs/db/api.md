# db — api

_N/A — the db domain has no direct HTTP surface._

Every API route that reads or writes a model lives in another domain:

| Need | See |
|---|---|
| Game CRUD | [games-shared/api.md](../games-shared/api.md) |
| Team CRUD | [teams/api.md](../teams/api.md) |
| Score read/write | [scoring/api.md](../scoring/api.md) |
| Mindgame state | [mindgame/api.md](../mindgame/api.md) |
| Unmasked state / actions | [unmasked/api.md](../unmasked/api.md) |
| Camp login | [camp-auth/api.md](../camp-auth/api.md) |
| Admin login + reset | [admin/api.md](../admin/api.md) |
| Cloudinary upload | [media-uploads/api.md](../media-uploads/api.md) |
| Public session info | [analytics/api.md](../analytics/api.md) |
| Seed | [seed/api.md](../seed/api.md) |
