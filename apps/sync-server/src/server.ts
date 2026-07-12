import type { IncomingMessage } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { applyIncomingMessage, encodeSyncStep1 } from "shared";
import { getRoom } from "./rooms.js";

/**
 * Document name comes from the connection path: `ws://host/<documentId>`.
 * No auth/RBAC here on purpose — that lands in M7, once the Next.js API
 * mints signed JWTs for sync-server to verify on handshake.
 */
function docNameFromRequest(req: IncomingMessage): string {
  const url = new URL(req.url ?? "/", "http://localhost");
  return url.pathname.replace(/^\//, "") || "default";
}

function send(socket: WebSocket, data: Uint8Array): void {
  if (socket.readyState === socket.OPEN) {
    socket.send(data);
  }
}

export function createSyncServer(port: number): WebSocketServer {
  const wss = new WebSocketServer({ port });

  wss.on("connection", (socket: WebSocket, req: IncomingMessage) => {
    const room = getRoom(docNameFromRequest(req));
    room.conns.add(socket);

    // handshake: tell the new client what we already have so it can send
    // back only what it's missing (state-vector diff, not a full doc dump)
    send(socket, encodeSyncStep1(room.doc));

    socket.on("message", (data: ArrayBuffer | Buffer | Buffer[]) => {
      const message = Array.isArray(data)
        ? new Uint8Array(Buffer.concat(data))
        : new Uint8Array(data as ArrayBuffer);
      const reply = applyIncomingMessage(message, room, socket);
      if (reply) send(socket, reply);
    });

    socket.on("close", () => {
      room.conns.delete(socket);
    });
  });

  return wss;
}
