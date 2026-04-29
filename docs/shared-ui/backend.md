# shared-ui — backend

_N/A — this domain has no server-side business logic._

The header is a server component but only reads cookies (no DB). The pages it contains have their own backends (admin, games, etc.).

The toast helpers in [`lib/ui/toast.ts`](../../lib/ui/toast.ts) are client-side only; they import `sonner` which is a browser library.

If you find yourself adding a database call to this domain's components, that's a sign the logic belongs elsewhere — extract to the matching domain's `lib/`.
