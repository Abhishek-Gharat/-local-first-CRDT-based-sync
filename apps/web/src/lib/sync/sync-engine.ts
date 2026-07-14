import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";
import {
  applyIncomingMessage,
  encodeAwarenessUpdate,
  encodeSyncStep1,
  encodeUpdate,
} from "shared";

export type ConnectionStatus = "online" | "offline" | "syncing" | "conflict-resolved";

export interface SyncEngineOptions {
  doc: Y.Doc;
  /** e.g. `wss://sync.example.com/<documentId>` — no token; getToken supplies one per attempt */
  url: string;
  /**
   * Called immediately before every connection attempt (the initial one and
   * every reconnect) to get a fresh handshake token, appended to `url` as
   * `?token=...`. Sync tokens are deliberately short-lived (60s — see
   * mintSyncToken's default), which is incompatible with baking one token
   * into a static URL at construction time: this is explicitly an
   * offline-first app, so a reconnect can happen arbitrarily long after the
   * token that was valid at connect time has expired. Fetching fresh here
   * is what keeps "reconnect after a long offline period" actually working
   * once the server enforces auth, instead of retrying forever with a
   * permanently-stale token.
   */
  getToken: () => Promise<string> | string;
  awareness?: Awareness;
  /** batches rapid local edits before sending a merged update — default 200ms */
  debounceMs?: number;
  /** base delay for reconnect backoff, doubles up to maxBackoffMs — default 500ms */
  minBackoffMs?: number;
  maxBackoffMs?: number;
  /**
   * How long the transient "conflict-resolved" status lingers after a remote
   * edit merges concurrent local changes, before reverting to the steady
   * online/syncing state — default 2500ms (long enough for a human to notice
   * the indicator, short enough not to feel stuck).
   */
  conflictResolvedMs?: number;
  onStatusChange?: (status: ConnectionStatus) => void;
}

export interface SyncEngine {
  awareness: Awareness;
  getStatus(): ConnectionStatus;
  destroy(): void;
}

/** Marks a Yjs transaction as having been applied from the remote peer, so
 *  the local `doc.on('update', ...)` listener can tell it apart from a
 *  genuinely local edit and avoid echoing it straight back. */
const REMOTE_ORIGIN = "sync-engine:remote";

/**
 * Wires a Yjs doc to a sync-server room over a plain WebSocket: sends a
 * debounced/merged batch of local updates instead of one message per
 * keystroke, replies to the server's sync handshake, relays awareness
 * (cursors/presence), and reconnects with exponential backoff if the
 * connection drops. Offline edits are never lost — they stay applied to
 * the local `doc` and get folded in via the standard SyncStep1/2 handshake
 * the moment the socket comes back up (see the sync-server test suite for
 * the exact convergence proof).
 */
export function createSyncEngine(options: SyncEngineOptions): SyncEngine {
  const {
    doc,
    url,
    getToken,
    awareness = new Awareness(doc),
    debounceMs = 200,
    minBackoffMs = 500,
    maxBackoffMs = 10_000,
    conflictResolvedMs = 2500,
    onStatusChange,
  } = options;

  let socket: WebSocket | null = null;
  let destroyed = false;
  let backoff = minBackoffMs;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let conflictTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingUpdates: Uint8Array[] = [];

  // The reported ConnectionStatus is *derived* from these two internal
  // signals rather than set directly, so every transition ("started
  // typing", "flush completed", "socket dropped", "remote merge landed")
  // routes through one recompute and can't leave the four public states
  // inconsistent with each other.
  let phase: "connecting" | "open" | "closed" = "connecting";
  let reportedStatus: ConnectionStatus = "syncing";

  function computeStatus(): ConnectionStatus {
    // Offline dominates: if the socket is down, nothing else about
    // in-flight edits or a recent merge is worth showing.
    if (phase === "closed") return "offline";
    // A just-merged concurrent edit is a transient, attention-worthy
    // overlay that outranks the steady online/syncing distinction.
    if (conflictTimer) return "conflict-resolved";
    // Still handshaking, or local edits are batched/in-flight to the server.
    if (phase === "connecting" || pendingUpdates.length > 0) return "syncing";
    return "online";
  }

  function recomputeStatus() {
    const next = computeStatus();
    if (next === reportedStatus) return;
    reportedStatus = next;
    onStatusChange?.(reportedStatus);
  }

  // Fired when a remote edit merges while we still have unsent local edits —
  // i.e. the CRDT just reconciled a genuine concurrent edit. Shows the
  // "conflict-resolved" state briefly (no user action needed — Yjs already
  // merged losslessly; this is purely to make the merge visible).
  function signalConflictResolved() {
    if (conflictTimer) clearTimeout(conflictTimer);
    conflictTimer = setTimeout(() => {
      conflictTimer = null;
      recomputeStatus();
    }, conflictResolvedMs);
    recomputeStatus();
  }

  function flushPendingUpdates() {
    debounceTimer = null;
    if (!pendingUpdates.length || !socket || socket.readyState !== socket.OPEN) return;
    const merged =
      pendingUpdates.length === 1 ? pendingUpdates[0] : Y.mergeUpdates(pendingUpdates);
    pendingUpdates = [];
    socket.send(encodeUpdate(merged));
    recomputeStatus();
  }

  function onDocUpdate(update: Uint8Array, origin: unknown) {
    if (origin === REMOTE_ORIGIN) {
      // A remote edit landed while our own edits are still queued locally:
      // the two were made concurrently and Yjs just merged them.
      if (pendingUpdates.length > 0) signalConflictResolved();
      return;
    }
    pendingUpdates.push(update);
    recomputeStatus();
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(flushPendingUpdates, debounceMs);
  }
  doc.on("update", onDocUpdate);

  function onAwarenessUpdate(changes: {
    added: number[];
    updated: number[];
    removed: number[];
  }) {
    if (!socket || socket.readyState !== socket.OPEN) return;
    const changedClients = changes.added.concat(changes.updated, changes.removed);
    socket.send(encodeAwarenessUpdate(awareness, changedClients));
  }
  awareness.on("update", onAwarenessUpdate);

  async function connect() {
    if (destroyed) return;
    phase = "connecting";
    recomputeStatus();

    let token: string;
    try {
      token = await getToken();
    } catch {
      // couldn't mint/fetch a token (e.g. still offline) — fall back to the
      // normal backoff/retry loop instead of throwing out of connect()
      scheduleReconnect();
      return;
    }
    if (destroyed) return;

    const separator = url.includes("?") ? "&" : "?";
    const ws = new WebSocket(`${url}${separator}token=${encodeURIComponent(token)}`);
    ws.binaryType = "arraybuffer";
    socket = ws;

    ws.addEventListener("open", () => {
      backoff = minBackoffMs;
      phase = "open";
      ws.send(encodeSyncStep1(doc));
      flushPendingUpdates();
      recomputeStatus();
    });

    ws.addEventListener("message", (event) => {
      const message = new Uint8Array(event.data as ArrayBuffer);
      const reply = applyIncomingMessage(message, { doc, awareness }, REMOTE_ORIGIN);
      if (reply) ws.send(reply);
    });

    ws.addEventListener("close", scheduleReconnect);
    ws.addEventListener("error", () => ws.close());
  }

  function scheduleReconnect() {
    if (destroyed) return;
    phase = "closed";
    recomputeStatus();
    if (reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      backoff = Math.min(backoff * 2, maxBackoffMs);
      void connect();
    }, backoff);
  }

  void connect();

  return {
    awareness,
    getStatus: () => reportedStatus,
    destroy() {
      destroyed = true;
      doc.off("update", onDocUpdate);
      awareness.off("update", onAwarenessUpdate);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (debounceTimer) clearTimeout(debounceTimer);
      if (conflictTimer) clearTimeout(conflictTimer);
      socket?.close();
    },
  };
}
