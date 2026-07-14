# Architecture

This document explains how the collaborative editor is built and — more importantly — *why* each
non-obvious decision was made. I've tried to be honest about trade-offs and about what I'd change
with more time rather than presenting everything as if it fell out of the sky fully formed.

## The core problem

The assignment is a distributed-systems problem dressed up as a text editor. Two people (or one
person on two devices, or one person online and then offline) edit the same document. Edits happen
concurrently, connections drop, and when everything reconnects the document has to converge to a
single consistent state **without losing anyone's work and without a "last write wins" clobber**.
That last constraint is what rules out the naive approaches — a REST endpoint that PUTs the whole
document, or an operational-transform server that has to be online to function.

My answer is a CRDT (Conflict-free Replicated Data Type). Specifically [Yjs](https://yjs.dev),
because CRDT updates are commutative and associative: applying remote update A then B produces the
exact same document as B then A. Convergence is a mathematical property of the data structure, not
something the server has to referee. That property is what makes genuine offline-first possible —
the client can accept edits with no server in the loop at all, and merging later is guaranteed safe.

## System shape

```
┌─────────────────┐         WebSocket          ┌──────────────────┐
│  Browser (web)  │  ◄──── Yjs sync proto ────► │  sync-server     │
│                 │        (state-vector)       │  (Node + ws)     │
│  Tiptap editor  │                             │                  │
│  Yjs Y.Doc      │                             │  in-memory rooms │
│  y-indexeddb ───┼─► local disk (source        │  1 Y.Doc / doc   │
│                 │    of truth, offline OK)     └──────────────────┘
└────────┬────────┘                                      
         │ HTTPS (REST)                          
         ▼                                        
┌─────────────────┐        ┌──────────────────┐
│  Next.js API    │ ─────► │  PostgreSQL      │
│  (auth, RBAC,   │  RLS   │  users, docs,    │
│   versions,     │        │  members,        │
│   token mint)   │        │  versions        │
└─────────────────┘        └──────────────────┘
```

Three deployable units in a pnpm monorepo:

- **`apps/web`** — the Next.js 16 app: editor UI, auth, all REST API routes, the Drizzle/Postgres
  client, and the client-side sync engine.
- **`apps/sync-server`** — a standalone Node WebSocket server. No build step (tsx runs the TS
  directly), no framework — just `ws` plus the shared sync protocol.
- **`packages/shared`** — the wire contract used by *both* sides: the Yjs message helpers, the Zod
  message-envelope schema, and the HMAC handshake-token codec. Compiled to `dist/` so a change to
  the protocol can't drift between client and server without a type error.

## Why a separate sync-server instead of Vercel serverless

This is the biggest architectural decision and it's a genuine trade-off, not a workaround I'm hiding.

Realtime collaboration needs **persistent, stateful connections**. A serverless function is the
opposite of that: it spins up per request, can't hold a WebSocket open for the lifetime of an
editing session, and has no shared memory between invocations to hold the live document room. So the
realtime transport can't live in a Next.js API route on Vercel.

The clean answer is a long-lived process that owns the WebSocket connections and keeps one in-memory
`Y.Doc` per open document (the "room"). That's `apps/sync-server`. It deploys to a platform that
supports long-running processes (Railway, Fly, Render, a VM) — not Vercel.

**The cost:** two deploy targets instead of one, and a shared secret that has to be configured in
both places. **The benefit:** each piece runs on infrastructure suited to its job — the web app gets
Vercel's edge/SSR/CI story, the sync-server gets a real event loop it can keep. I judged that split
worth it; trying to force realtime into serverless (via polling, or a third-party realtime SaaS)
would have been more moving parts and less control, and it would dodge exactly the distributed-systems
problem the assignment is asking me to engage with.

## Local-first: the client is the source of truth

The requirement is "open, edit, and close documents with zero network requests blocking the UI." The
implementation:

- Every document is a Yjs `Y.Doc`. Tiptap (ProseMirror) binds to it through `y-prosemirror`, so
  every keystroke is a CRDT operation, not a diff computed later.
- `y-indexeddb` persists the `Y.Doc` to the browser's IndexedDB on every update. This is the actual
  source of truth. Reload the page with the network off and the document is still there, fully
  editable.
- The sync engine ([`sync-engine.ts`](apps/web/src/lib/sync/sync-engine.ts)) is layered *on top* of
  this, never in front of it. Local edits are applied to the local doc immediately and
  unconditionally; the socket is only how they eventually reach other people. If the socket is down,
  editing is completely unaffected — the edits queue and flush on reconnect.

## The sync engine (client side)

`createSyncEngine` wires a `Y.Doc` to a sync-server room. The parts worth calling out:

- **Debounced batching.** Rapid typing would otherwise send one WebSocket frame per keystroke.
  Instead local updates are collected for ~200ms and merged with `Y.mergeUpdates` into a single
  frame. Less socket chatter, same end state.
- **Fresh token per connection attempt.** The handshake token is deliberately short-lived (60s). In
  an offline-first app a reconnect can happen arbitrarily long after the original token expired, so
  baking a token into the URL at construction time would mean "reconnect after a long offline period"
  silently fails once auth is enforced. The engine calls `getToken()` immediately before *every*
  connection attempt instead.
- **Exponential backoff** on reconnect (500ms doubling to 10s), reset on a successful open.
- **Status is derived, never set directly.** The four public states
  (`online`/`offline`/`syncing`/`conflict-resolved`) are computed from two internal signals (socket
  phase + whether local edits are in flight) through a single `computeStatus()` function, so a
  transition can't leave the reported status inconsistent with reality. `conflict-resolved` fires
  specifically when a remote edit merges *while local edits are still queued* — i.e. a real
  concurrent edit that the CRDT just reconciled — and lingers ~2.5s so a human can actually see it.

## Conflict resolution: why there's nothing to "resolve"

There's no merge-conflict UI because there are no merge conflicts in the git sense. When two clients
edit concurrently, both sets of operations are valid CRDT ops and `Y.applyUpdate` *merges* them — it
never replaces. Convergence is deterministic: every client that has seen the same set of updates,
in any order, computes byte-identical document state.

What the UI surfaces instead is *transparency*: the `conflict-resolved` indicator tells the user "a
concurrent edit just got folded in losslessly," because a merge that's invisible is unsettling even
when it's correct. This is proven end-to-end in
[`collaboration.spec.ts`](apps/web/e2e/collaboration.spec.ts): two tabs, one goes offline, both edit,
the offline one reconnects — both fragments end up in both tabs and the text converges identically.

## Version history: non-destructive restore

Snapshots are `Y.encodeStateAsUpdate(doc)` blobs stored in the append-only `document_versions` table
(`bytea` column). The interesting part is **restore**, in
[`restore.ts`](apps/web/src/lib/history/restore.ts).

The naive restore — `Y.applyUpdate(liveDoc, oldSnapshot)` — is wrong. It just replays the old ops as
*new* history on top of everything collaborators have written since, which doesn't undo current
content; it fights it. So restore instead:

1. Loads the snapshot into a throwaway scratch `Y.Doc`.
2. Converts its content to a ProseMirror node.
3. **Diffs that against the live doc's current content** and applies only the difference as one new
   forward transaction (`updateYFragment`).

The result is that restoring to a past version is just *another normal edit* from every other
client's perspective — it arrives over the sync connection like any keystroke, merges losslessly, and
never corrupts an active collaborator's state. History moves forward; it's never rewritten. The table
grants no UPDATE/DELETE policy on purpose — a version, once written, is immutable.

## Security

Four distinct concerns, four distinct mechanisms.

### 1. Viewers must not be able to write (RBAC on the realtime channel)

Hiding the edit button is not security. Enforcement is at the wire-protocol level:

- When a client opens a document, the Next.js API checks `document_members` and mints a short-lived
  HMAC token embedding `{ userId, documentId, role, exp }`
  ([`sync-token.ts`](packages/shared/src/sync-token.ts)).
- The sync-server verifies that token during the **HTTP upgrade** (`verifyClient`), before any
  WebSocket exists, and binds the token's `documentId` to the actual connection path — so a token
  minted for one doc can't be replayed against another.
- Then, on *every incoming message*, it re-checks: a `viewer`-role connection that sends a mutating
  frame (SyncStep2 / Update) gets the socket closed with `4403`. Viewers can still send read-only
  SyncStep1 and awareness (cursor) frames — they just can't mutate.

I used a raw HMAC-over-JSON token rather than a full JWT library on purpose: both sides only need
"did this shared secret sign this exact payload, and has it expired." None of what a JWT library adds
(algorithm negotiation, and with it alg-confusion attack surface) is wanted here.

### 2. Preventing a malformed/oversized payload from OOMing the server

This is called out explicitly in the brief, and it's defended in depth
([`server.ts`](apps/sync-server/src/server.ts)):

- **`ws` `maxPayload`** is set to `MAX_MESSAGE_BYTES`. `ws` rejects a frame larger than this *before
  it's fully buffered into memory*, closing with `1009` — the oversized bytes never accumulate.
- **`parseMessageEnvelope`** re-checks the size bound and validates the envelope shape *before* any
  Yjs decode runs on the content. A malformed-but-small frame is dropped with `4400`;
  `Y.applyUpdate` never touches unvalidated input.
- **A per-connection `error` listener.** This is the subtle one: `ws` emits `error` on a protocol
  fault (like an over-maxPayload frame). With no listener, that error becomes an uncaught exception
  and takes the *whole process* down — meaning a single malicious client could DoS every document on
  the server. The handler swallows it per-connection: drop that socket, keep serving everyone else.
  [`validation.spec.ts`](apps/web/e2e/validation.spec.ts) fires a real 2MB frame at the live server
  and then proves a fresh client can still connect — the attack drops one socket, not the server.

### 3. Tenant isolation (Row-Level Security)

Drizzle doesn't manage RLS, so it's enforced at the Postgres level in a raw SQL migration
([`0001_rls_policies.sql`](apps/web/src/db/migrations/0001_rls_policies.sql)) and it does *not* rely
on the application remembering to add a `WHERE` clause:

- Every policy derives from `app_current_user_id()`, which reads a per-transaction session variable.
- [`withUserContext(userId, fn)`](apps/web/src/db/with-user-context.ts) opens a transaction, sets
  that variable with `SET LOCAL`, and runs the query inside it. A handler that forgets to filter
  *still* can't leak cross-tenant rows, because Postgres itself rejects them.
- `FORCE ROW LEVEL SECURITY` is set on every table, because the migration role owns the tables and
  Postgres skips RLS for a table's owner otherwise.
- Critically, **the app connects as a restricted, non-superuser role** (`app_user` /
  `APP_DATABASE_URL`), never the superuser used for migrations (`DATABASE_URL`) — because superusers
  and `BYPASSRLS` roles skip RLS entirely. RLS is only real if the runtime role is actually subject
  to it.

### 4. Authentication

NextAuth v5 with a Credentials provider, bcrypt-hashed passwords, JWT session strategy. API routes
check role via `requireDocumentRole` before doing anything mutating.

## Data model

| Table | Purpose | Notes |
|---|---|---|
| `users` | accounts | bcrypt `password_hash`; RLS: you see yourself + people you share docs with |
| `documents` | doc metadata | `owner_id`, title, timestamps |
| `document_members` | RBAC | `(document_id, user_id)` unique; `role` enum owner/editor/viewer |
| `document_versions` | history | append-only `bytea` snapshot blobs; no UPDATE/DELETE policy |

The document *content* deliberately lives in Yjs (IndexedDB client-side, in-memory rooms
server-side), not in a Postgres column. Postgres holds identity, permissions, and version snapshots —
the things that need durable, queryable, access-controlled storage. The live CRDT state is the
editor's job.

## AI add-on: change summaries

The version-history sidebar has a "Summarize changes" action that diffs a saved version against the
current live document and produces a plain-language summary via the Vercel AI SDK
([`summarize.ts`](apps/web/src/lib/ai/summarize.ts)).

Two things I care about here:

- **Provider-swappable via env** (`AI_PROVIDER` = anthropic/openai, or inferred from whichever API
  key is present). The provider SDK is imported lazily so an unused provider isn't bundled.
- **Graceful degradation is the headline, not an afterthought.** With *no* key configured it returns
  a deterministic word-count diff explicitly labelled "(no AI provider configured)" — never a canned
  AI-sounding sentence, never a 500. Same fallback on empty output or a network error. The `before`
  text is read from the DB by version id (a client can't inject arbitrary before-text); the `after`
  is the client's current snapshot. Because it's read-only, viewers can use it too. Provenance
  (`aiGenerated: boolean`) is surfaced in the UI — the app never claims AI authorship it didn't do.

## Testing strategy

- **Vitest** for units and integration (49 tests). The RLS and RBAC integration tests hit a *real*
  Postgres — a mock would defeat the entire point of testing tenant isolation. They `skipIf` the DB
  env is absent, so `pnpm test` still passes without a database, and CI always provides one.
- **Playwright** for e2e (4 tests) against the *real* stack — Next.js production build + sync-server +
  Postgres, all booted by Playwright. This is where the three headline criteria get end-to-end
  coverage in an actual browser: offline-edit-reconnect convergence, wire-level viewer rejection, and
  the oversized-payload attack.

## CI/CD

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) reproduces the exact local gate against a real
Postgres service container: build shared → provision the restricted role → migrate → lint → typecheck
→ test → build → e2e. A deploy job runs only on a green push to `main` and is guarded per provider
secret, so it's a safe no-op until Vercel/Railway secrets are added (it never fails the pipeline just
because deploy targets aren't wired up yet).

## What I'd do differently with more time

Being honest about the edges:

- **CRDT history compaction / garbage collection.** This is the real one, and the assignment flags it.
  A Yjs document's update log grows monotonically — every edit and every *deletion* leaves a
  tombstone that's never reclaimed. Over a long-lived document with heavy editing, both the IndexedDB
  store and the server room grow unbounded. The production answer is periodic compaction: snapshot the
  current state, start a fresh doc from it, and drop the old history — coordinated so no client loses
  in-flight ops. I have the snapshot primitive (version history uses it) but not the compaction loop.
- **Sync-server persistence and horizontal scale.** Right now rooms are in-memory: if the sync-server
  restarts, unsaved live state that hasn't been snapshotted is gone (clients still hold it in
  IndexedDB and re-sync, so it's recoverable, but the server itself is stateless-by-accident rather
  than by design). And a single process can't scale horizontally — two sync-server instances wouldn't
  share rooms. The fix is a shared backing store (Redis pub/sub for cross-instance fan-out, periodic
  doc persistence to Postgres/S3) so rooms survive restarts and any instance can serve any document.
- **Awareness / presence UI.** The protocol relays awareness (cursors, selections, who's online) and
  the sync engine forwards it, but I didn't build the collaborator-cursors UI on top. The plumbing is
  there; the visualization isn't.
- **Snapshot cadence.** Versions are captured manually. Automatic periodic snapshots (debounced,
  server-side) would make the history genuinely useful without the user remembering to save.
- **Deploy actually live.** CI is green and the deploy job is wired, but I haven't stood up the Vercel
  + Neon + Railway accounts to point it at real infrastructure. That's a setup step, not a code gap.
