import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";
import type { WebSocket } from "ws";
import { encodeAwarenessUpdate, encodeUpdate, type DocumentRole } from "shared";

/**
 * One in-memory "room" per document: the authoritative Yjs doc for that
 * document (as far as this server process is concerned) plus its shared
 * awareness state and the currently-connected sockets. No persistence here
 * — the source of truth for *durable* history is `document_versions` in
 * Postgres (M8); this is purely the live relay.
 *
 * `conns` maps each socket to the role its handshake token was verified
 * for (see server.ts) — read by the message handler to reject mutating
 * frames from viewer-role connections.
 */
export interface Room {
  doc: Y.Doc;
  awareness: Awareness;
  conns: Map<WebSocket, DocumentRole>;
}

const rooms = new Map<string, Room>();

function send(socket: WebSocket, data: Uint8Array): void {
  if (socket.readyState === socket.OPEN) {
    socket.send(data);
  }
}

function broadcast(room: Room, data: Uint8Array, exclude: unknown): void {
  for (const conn of room.conns.keys()) {
    if (conn !== exclude) send(conn, data);
  }
}

export function getRoom(docName: string): Room {
  let room = rooms.get(docName);
  if (!room) {
    const doc = new Y.Doc();
    const awareness = new Awareness(doc);
    room = { doc, awareness, conns: new Map() };
    rooms.set(docName, room);

    // Wired exactly once per room, not per connection: `origin` on these
    // events is whichever socket's incoming message caused the change, so
    // this single listener can broadcast to "everyone else" correctly. A
    // per-connection listener would each need to exclude a *different*
    // socket, which isn't how Yjs event listeners compose.
    doc.on("update", (update: Uint8Array, origin: unknown) => {
      broadcast(room!, encodeUpdate(update), origin);
    });

    awareness.on(
      "update",
      (
        changes: { added: number[]; updated: number[]; removed: number[] },
        origin: unknown,
      ) => {
        const changedClients = changes.added.concat(changes.updated, changes.removed);
        broadcast(room!, encodeAwarenessUpdate(awareness, changedClients), origin);
      },
    );
  }
  return room;
}

/** Test-only: rooms are otherwise process-lifetime singletons keyed by name. */
export function resetRooms(): void {
  rooms.clear();
}
