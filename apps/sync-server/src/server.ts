import type { IncomingMessage } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import {
  applyIncomingMessage,
  encodeSyncStep1,
  verifySyncToken,
  type SyncTokenPayload,
} from "shared";
import { getRoom } from "./rooms.js";
import { isMutatingSyncMessage } from "./message-guard.js";

/**
 * Document name comes from the connection path: `ws://host/<documentId>`.
 */
function docNameFromRequest(req: IncomingMessage): string {
  const url = new URL(req.url ?? "/", "http://localhost");
  return url.pathname.replace(/^\//, "") || "default";
}

// Browsers can't set custom headers on a WS upgrade request, so the signed
// handshake token (minted at GET /api/documents/[id]/sync-token) travels as
// a query param instead: ws://host/<documentId>?token=...
function tokenFromRequest(req: IncomingMessage): string | null {
  const url = new URL(req.url ?? "/", "http://localhost");
  return url.searchParams.get("token");
}

function send(socket: WebSocket, data: Uint8Array): void {
  if (socket.readyState === socket.OPEN) {
    socket.send(data);
  }
}

export interface CreateSyncServerOptions {
  /** Shared HMAC secret used to verify handshake tokens — must match
   * apps/web's SYNC_TOKEN_SECRET exactly (see packages/shared/src/sync-token.ts). */
  tokenSecret: string;
}

export function createSyncServer(
  port: number,
  { tokenSecret }: CreateSyncServerOptions,
): WebSocketServer {
  // verifyClient runs during the HTTP upgrade, before any WebSocket exists,
  // so an invalid/expired/wrong-document token gets a real 401 instead of
  // being accepted and closed immediately after. Its verified payload is
  // handed to the 'connection' handler via this WeakMap keyed on the shared
  // `req` object — verifyClient and 'connection' don't share arguments
  // otherwise, and mutating `req` directly would need an `any` cast.
  const verifiedPayloads = new WeakMap<IncomingMessage, SyncTokenPayload>();

  const wss = new WebSocketServer({
    port,
    verifyClient: ({ req }, callback) => {
      const token = tokenFromRequest(req);
      const payload = token ? verifySyncToken(token, tokenSecret) : null;
      // Binding the token's embedded documentId to the actual connection
      // path prevents a token minted for one document being replayed
      // against a different one.
      if (!payload || payload.documentId !== docNameFromRequest(req)) {
        callback(false, 401, "unauthorized");
        return;
      }
      verifiedPayloads.set(req, payload);
      callback(true);
    },
  });

  wss.on("connection", (socket: WebSocket, req: IncomingMessage) => {
    const payload = verifiedPayloads.get(req);
    verifiedPayloads.delete(req);
    // Unreachable in practice — verifyClient already rejected anything
    // without a valid payload — but narrows the type for what follows.
    if (!payload) {
      socket.close(4401, "unauthorized");
      return;
    }

    const room = getRoom(payload.documentId);
    room.conns.set(socket, payload.role);

    // handshake: tell the new client what we already have so it can send
    // back only what it's missing (state-vector diff, not a full doc dump)
    send(socket, encodeSyncStep1(room.doc));

    socket.on("message", (data: ArrayBuffer | Buffer | Buffer[]) => {
      const message = Array.isArray(data)
        ? new Uint8Array(Buffer.concat(data))
        : new Uint8Array(data as ArrayBuffer);

      // Viewers may still exchange SyncStep1 (read-only state-vector
      // announcements) and awareness (cursor/presence) — only frames that
      // actually mutate the document (SyncStep2, Update) are rejected.
      if (payload.role === "viewer" && isMutatingSyncMessage(message)) {
        socket.close(4403, "forbidden: viewer role cannot write");
        return;
      }

      const reply = applyIncomingMessage(message, room, socket);
      if (reply) send(socket, reply);
    });

    socket.on("close", () => {
      room.conns.delete(socket);
    });
  });

  return wss;
}
