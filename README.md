# docsync — Local-First Collaborative Document Editor

A collaborative rich-text editor built around a CRDT (Yjs), so it works **fully offline**, syncs
**without ever clobbering unsynced work**, and merges concurrent edits **deterministically with zero
data loss**. Documents have version history with non-destructive time-travel, role-based access
control enforced at the WebSocket wire level, Postgres Row-Level Security for tenant isolation, and an
optional AI change-summary feature.

This is not a CRUD app — the hard parts are the distributed-systems ones: offline state
reconciliation, concurrent-edit convergence, and hardening the realtime channel against malformed
payloads and unauthorized writes.

> **Design deep-dive:** see [ARCHITECTURE.md](ARCHITECTURE.md) for the *why* behind every major
> decision, the security model, and an honest "what I'd do differently with more time."

## Feature overview

- **Local-first** — the browser (Yjs `Y.Doc` + IndexedDB) is the source of truth. Open, edit, and
  close documents with the network off; nothing blocks the UI on a request.
- **Background sync** — a debounced, auto-reconnecting sync engine pushes local changes and pulls
  remote ones over the Yjs state-vector protocol. Offline edits are never overwritten on reconnect.
- **Deterministic conflict resolution** — CRDT merges are commutative; concurrent edits converge to
  identical state. A `conflict-resolved` indicator makes an otherwise-invisible merge visible.
- **Version history + non-destructive restore** — snapshot a document, browse the timeline, restore
  a past version as a *new forward edit* that never corrupts a live collaborator's state.
- **RBAC** — Owner / Editor / Viewer. Viewers cannot push writes to the realtime server; this is
  enforced on the WebSocket handshake **and** on every message, not just hidden in the UI.
- **Hardened realtime channel** — size caps reject oversized frames before they buffer into memory;
  a single malformed client can't OOM or crash the server.
- **Tenant isolation** — Postgres RLS keyed off a per-request session variable; the app connects as a
  non-superuser role that's actually subject to the policies.
- **AI change summaries** — provider-swappable (Anthropic/OpenAI) via env, with graceful degradation
  when no key is configured.
- **Accessible** — `aria-live` connection status, keyboard-navigable version history, axe-core pass.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript) |
| Editor | Tiptap (ProseMirror) + `y-prosemirror` |
| CRDT | Yjs, persisted locally via `y-indexeddb` |
| Realtime | standalone Node `ws` server (`apps/sync-server`) |
| Database | PostgreSQL + Drizzle ORM, with raw-SQL RLS policies |
| Auth | NextAuth v5, Credentials provider (bcrypt) |
| AI | Vercel AI SDK (provider-swappable) |
| Styling | Tailwind CSS + shadcn/ui |
| Tests | Vitest (unit/integration) + Playwright (e2e) |
| Monorepo | pnpm workspaces |

## Repository layout

```
apps/
  web/            # Next.js app: editor UI, API routes, auth, Drizzle client, sync engine
  sync-server/    # Node ws server: Yjs sync protocol, RBAC enforcement, payload validation
packages/
  shared/         # wire contract: sync-protocol helpers, Zod envelope schema, HMAC token codec
docker-compose.yml
.github/workflows/ci.yml
ARCHITECTURE.md
```

## Getting started

### Prerequisites

- Node **20+** (24 recommended — the sync-server uses `--env-file`)
- pnpm **10+**
- Docker (for local Postgres), or any Postgres 16 instance (e.g. Neon)

### 1. Install

```bash
pnpm install
```

### 2. Start Postgres

```bash
pnpm db:up          # starts postgres:16 via docker compose, provisions the restricted app_user role
```

Using a hosted Postgres (e.g. Neon) instead? Skip this and point the env vars below at it — you'll
need to create the non-superuser `app_user` role by hand (see the header of
`apps/web/src/db/migrations/0001_rls_policies.sql`).

### 3. Configure environment

Copy the example env files and fill in real values:

```bash
cp apps/web/.env.example apps/web/.env
cp apps/sync-server/.env.example apps/sync-server/.env
```

Key variables (see the `.env.example` files for the full, commented list):

| Variable | Where | Purpose |
|---|---|---|
| `DATABASE_URL` | web | **superuser** connection — migrations only (bypasses RLS) |
| `APP_DATABASE_URL` | web | **restricted** connection — the running app (subject to RLS) |
| `AUTH_SECRET` | web | NextAuth session signing (`openssl rand -base64 32`) |
| `SYNC_TOKEN_SECRET` | web + sync-server | HMAC secret for handshake tokens — **must match on both sides** |
| `NEXT_PUBLIC_SYNC_SERVER_URL` | web | browser-facing WS URL of the sync-server |
| `SYNC_SERVER_PORT` | sync-server | port the ws server listens on (default 1234) |
| `AI_PROVIDER` / `*_API_KEY` | web | *optional* — AI summaries; degrades gracefully if unset |

### 4. Run migrations

```bash
pnpm --filter web db:migrate
```

### 5. Start both servers

```bash
pnpm dev            # Next.js web app  -> http://localhost:3000
pnpm dev:sync       # sync-server (ws) -> ws://localhost:1234   (separate terminal)
```

Open http://localhost:3000, register an account, and create a document. To see collaboration, open
the same document in a second browser (or share it as a member) and watch edits sync in real time.
To see the local-first behavior, disable your network and keep editing — then re-enable it and watch
the changes reconcile.

## Testing

```bash
pnpm lint                    # eslint, all packages
pnpm typecheck               # tsc --noEmit, all packages
pnpm test                    # vitest: unit + integration (49 tests)
pnpm --filter web test:e2e   # playwright e2e against the real stack (builds first)
```

The RLS/RBAC integration tests need a real Postgres (`DATABASE_URL` + `APP_DATABASE_URL`); they
`skipIf` those are absent, so `pnpm test` passes without a DB. The Playwright suite boots the
production web build + the sync-server + Postgres automatically.

### Verifying the three headline criteria

- **Offline convergence** — `apps/web/e2e/collaboration.spec.ts`: two tabs, one goes offline, both
  edit, reconnect → both fragments present in both tabs, text converges identically.
- **Viewer cannot write** — `apps/web/e2e/rbac.spec.ts`: a viewer forcing an edit does not propagate
  to the owner (rejected at the wire, `4403`).
- **Payload validation** — `apps/web/e2e/validation.spec.ts`: a 2MB frame is rejected and the server
  keeps serving other clients.

## CI/CD

`.github/workflows/ci.yml` runs the full gate on every push/PR to `main` against a real Postgres
service container: build shared → provision role → migrate → lint → typecheck → test → build → e2e.

A `deploy` job runs on green pushes to `main` and is guarded per provider secret — it's a safe no-op
until you add deploy targets:

- **Web → Vercel:** add repo secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.
- **Sync-server → Railway:** add repo secret `RAILWAY_TOKEN`.

Until those exist, CI stays green and simply skips deploy. Deploying also requires a production
Postgres (e.g. Neon) with the `app_user` role created and migrations run against it.

## License

Built as a take-home assignment. Not licensed for redistribution.

<!-- assignment submission token — do not remove -->
fe_oa_282086b9aae3c7ff2c94a2dd54328a31f33ff82527e2a79c
