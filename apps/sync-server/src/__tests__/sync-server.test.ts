import { describe, it, expect, afterEach } from "vitest";
import * as Y from "yjs";
import { WebSocketServer } from "ws";
import {
  applyIncomingMessage,
  encodeSyncStep1,
  encodeUpdate,
  mintSyncToken,
  type DocumentRole,
} from "shared";
import { Awareness } from "y-protocols/awareness";
import { createSyncServer } from "../server.js";
import { resetRooms } from "../rooms.js";

const TEST_SECRET = "test-secret-not-for-production";

/**
 * Minimal stand-in for the real client sync engine (apps/web/src/lib/sync),
 * just enough wire protocol to prove the server relays and converges
 * correctly. Not the production client — that has debouncing/backoff on
 * top of the same `shared` helpers.
 */
function connectClient(
  port: number,
  docName: string,
  doc: Y.Doc,
  role: DocumentRole = "editor",
) {
  const awareness = new Awareness(doc);
  const token = mintSyncToken({ userId: "user-1", documentId: docName, role }, TEST_SECRET);
  const socket = new WebSocket(`ws://localhost:${port}/${docName}?token=${token}`);
  socket.binaryType = "arraybuffer";

  const opened = new Promise<void>((resolve) => {
    socket.addEventListener("open", () => resolve(), { once: true });
  });

  socket.addEventListener("message", (event) => {
    const message = new Uint8Array(event.data as ArrayBuffer);
    const reply = applyIncomingMessage(message, { doc, awareness }, "remote");
    if (reply) socket.send(reply);
  });

  doc.on("update", (update: Uint8Array, origin: unknown) => {
    if (origin === "remote") return;
    if (socket.readyState === socket.OPEN) socket.send(encodeUpdate(update));
  });

  return {
    socket,
    opened,
    sendSyncStep1: () => socket.send(encodeSyncStep1(doc)),
    close: () => socket.close(),
  };
}

describe("sync-server convergence", () => {
  let wss: WebSocketServer | undefined;

  afterEach(() => {
    wss?.close();
    wss = undefined;
    resetRooms();
  });

  it("relays live edits between two connected clients", async () => {
    wss = createSyncServer(0, { tokenSecret: TEST_SECRET });
    const port = (wss.address() as { port: number }).port;

    const docA = new Y.Doc();
    const docB = new Y.Doc();
    const clientA = connectClient(port, "doc-live", docA);
    const clientB = connectClient(port, "doc-live", docB);
    await Promise.all([clientA.opened, clientB.opened]);
    clientA.sendSyncStep1();
    clientB.sendSyncStep1();

    docA.getText("content").insert(0, "hello from A");
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(docB.getText("content").toString()).toBe("hello from A");

    clientA.close();
    clientB.close();
  });

  it("converges an offline client's edits with zero data loss on reconnect", async () => {
    wss = createSyncServer(0, { tokenSecret: TEST_SECRET });
    const port = (wss.address() as { port: number }).port;

    const docOnline = new Y.Doc();
    const docOffline = new Y.Doc();

    // client B edits while genuinely disconnected — never opens a socket
    docOffline.getText("content").insert(0, "offline edit");

    const online = connectClient(port, "doc-reconnect", docOnline);
    await online.opened;
    online.sendSyncStep1();
    docOnline.getText("content").insert(0, "online edit / ");
    await new Promise((resolve) => setTimeout(resolve, 100));

    // now the offline client comes online and joins the same room
    const reconnected = connectClient(port, "doc-reconnect", docOffline);
    await reconnected.opened;
    reconnected.sendSyncStep1();
    await new Promise((resolve) => setTimeout(resolve, 150));

    const finalOnline = docOnline.getText("content").toString();
    const finalOffline = docOffline.getText("content").toString();

    expect(finalOnline).toBe(finalOffline);
    expect(finalOnline).toContain("online edit");
    expect(finalOnline).toContain("offline edit");
    expect(Y.encodeStateAsUpdate(docOnline)).toEqual(Y.encodeStateAsUpdate(docOffline));

    online.close();
    reconnected.close();
  });

  it("rejects a write from a viewer-role connection and leaves the document unchanged", async () => {
    wss = createSyncServer(0, { tokenSecret: TEST_SECRET });
    const port = (wss.address() as { port: number }).port;

    const docEditor = new Y.Doc();
    const docViewer = new Y.Doc();

    const editor = connectClient(port, "doc-viewer-write", docEditor, "editor");
    const viewer = connectClient(port, "doc-viewer-write", docViewer, "viewer");
    await Promise.all([editor.opened, viewer.opened]);
    editor.sendSyncStep1();
    viewer.sendSyncStep1();

    const viewerClosed = new Promise<{ code: number }>((resolve) => {
      viewer.socket.addEventListener("close", (event) => resolve({ code: event.code }), {
        once: true,
      });
    });

    // a mutating edit on the viewer side is relayed as an Update frame by
    // connectClient's doc.on('update', ...) wiring — same as a real client
    docViewer.getText("content").insert(0, "viewer should not be able to write this");
    const { code } = await viewerClosed;

    expect(code).toBe(4403);
    expect(docEditor.getText("content").toString()).toBe("");

    editor.close();
  });
});
