import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";
import {
  applyIncomingMessage,
  encodeAwarenessUpdate,
  encodeSyncStep1,
  encodeUpdate,
} from "shared";

export type ConnectionStatus = "connecting" | "connected" | "offline";

export interface SyncEngineOptions {
  doc: Y.Doc;
  /** e.g. `wss://sync.example.com/<documentId>` */
  url: string;
  awareness?: Awareness;
  /** batches rapid local edits before sending a merged update — default 200ms */
  debounceMs?: number;
  /** base delay for reconnect backoff, doubles up to maxBackoffMs — default 500ms */
  minBackoffMs?: number;
  maxBackoffMs?: number;
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
    awareness = new Awareness(doc),
    debounceMs = 200,
    minBackoffMs = 500,
    maxBackoffMs = 10_000,
    onStatusChange,
  } = options;

  let socket: WebSocket | null = null;
  let status: ConnectionStatus = "connecting";
  let destroyed = false;
  let backoff = minBackoffMs;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingUpdates: Uint8Array[] = [];

  function setStatus(next: ConnectionStatus) {
    if (status === next) return;
    status = next;
    onStatusChange?.(status);
  }

  function flushPendingUpdates() {
    debounceTimer = null;
    if (!pendingUpdates.length || !socket || socket.readyState !== socket.OPEN) return;
    const merged =
      pendingUpdates.length === 1 ? pendingUpdates[0] : Y.mergeUpdates(pendingUpdates);
    pendingUpdates = [];
    socket.send(encodeUpdate(merged));
  }

  function onDocUpdate(update: Uint8Array, origin: unknown) {
    if (origin === REMOTE_ORIGIN) return;
    pendingUpdates.push(update);
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

  function connect() {
    if (destroyed) return;
    setStatus("connecting");
    const ws = new WebSocket(url);
    ws.binaryType = "arraybuffer";
    socket = ws;

    ws.addEventListener("open", () => {
      backoff = minBackoffMs;
      setStatus("connected");
      ws.send(encodeSyncStep1(doc));
      flushPendingUpdates();
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
    setStatus("offline");
    if (reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      backoff = Math.min(backoff * 2, maxBackoffMs);
      connect();
    }, backoff);
  }

  connect();

  return {
    awareness,
    getStatus: () => status,
    destroy() {
      destroyed = true;
      doc.off("update", onDocUpdate);
      awareness.off("update", onAwarenessUpdate);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (debounceTimer) clearTimeout(debounceTimer);
      socket?.close();
    },
  };
}
