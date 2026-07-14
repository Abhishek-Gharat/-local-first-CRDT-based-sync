import { describe, it, expect, afterEach } from "vitest";
import * as Y from "yjs";
import * as decoding from "lib0/decoding";
import { MESSAGE_SYNC, mintSyncToken } from "shared";
import * as syncProtocol from "y-protocols/sync";
import type { WebSocketServer } from "ws";
import { createSyncServer } from "sync-server";
import { createSyncEngine, type SyncEngine } from "../sync-engine.js";

const TEST_SECRET = "test-secret-not-for-production";

function serverPort(wss: WebSocketServer): number {
  return (wss.address() as { port: number }).port;
}

function getToken(documentId: string): () => string {
  return () => mintSyncToken({ userId: "user-1", documentId, role: "editor" }, TEST_SECRET);
}

function waitFor(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      if (predicate()) return resolve();
      if (Date.now() - start > timeoutMs) return reject(new Error("waitFor timed out"));
      setTimeout(tick, 10);
    };
    tick();
  });
}

describe("createSyncEngine", () => {
  let wss: WebSocketServer | undefined;
  const engines: SyncEngine[] = [];

  afterEach(() => {
    engines.splice(0).forEach((engine) => engine.destroy());
    wss?.close();
    wss = undefined;
  });

  it("debounces rapid local edits into a single merged update message", async () => {
    wss = createSyncServer(0, { tokenSecret: TEST_SECRET });
    const port = serverPort(wss);

    let updateMessages = 0;
    wss.on("connection", (socket) => {
      socket.on("message", (data: Buffer) => {
        // Only count actual "sync update" frames (messageYjsUpdate), not
        // the SyncStep1/SyncStep2 handshake frames every connection sends
        // regardless of how many local edits happen — those would make
        // this test racy against handshake timing instead of measuring
        // the thing it's meant to measure: debounce batching.
        const decoder = decoding.createDecoder(new Uint8Array(data));
        const messageType = decoding.readVarUint(decoder);
        if (messageType !== MESSAGE_SYNC) return;
        const syncMessageType = decoding.readVarUint(decoder);
        if (syncMessageType === syncProtocol.messageYjsUpdate) updateMessages += 1;
      });
    });

    const doc = new Y.Doc();
    const engine = createSyncEngine({
      doc,
      url: `ws://localhost:${port}/debounce-room`,
      getToken: getToken("debounce-room"),
      debounceMs: 50,
    });
    engines.push(engine);

    await waitFor(() => engine.getStatus() === "online");

    const text = doc.getText("content");
    for (let i = 0; i < 5; i += 1) {
      text.insert(text.length, `${i}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 150));

    // 5 edits, all within one debounce window, should reach the server as
    // exactly one merged update frame — not five.
    expect(updateMessages).toBe(1);
    expect(text.toString()).toBe("01234");
  });

  it("recovers from a dropped connection and converges via exponential-backoff reconnect", async () => {
    wss = createSyncServer(0, { tokenSecret: TEST_SECRET });
    const port = serverPort(wss);
    const url = `ws://localhost:${port}/reconnect-room`;

    const docA = new Y.Doc();
    const docB = new Y.Doc();
    const engineA = createSyncEngine({
      doc: docA,
      url,
      getToken: getToken("reconnect-room"),
      debounceMs: 20,
      minBackoffMs: 30,
    });
    const engineB = createSyncEngine({
      doc: docB,
      url,
      getToken: getToken("reconnect-room"),
      debounceMs: 20,
      minBackoffMs: 30,
    });
    engines.push(engineA, engineB);

    await waitFor(() => engineA.getStatus() === "online");
    await waitFor(() => engineB.getStatus() === "online");

    // simulate B's network dropping mid-session by terminating its
    // connection from the server side — B's own edit below happens while
    // genuinely disconnected, proving offline-first: local edits never
    // wait on the network.
    for (const conn of wss.clients) {
      conn.terminate();
    }
    await waitFor(() => engineB.getStatus() === "offline");

    docB.getText("content").insert(0, "offline edit from B");
    docA.getText("content").insert(0, "edit from A / ");

    // engineB's backoff timer fires and it reconnects to the same server on
    // its own — no manual intervention.
    await waitFor(() => engineB.getStatus() === "online", 5000);
    await new Promise((resolve) => setTimeout(resolve, 200));

    const finalA = docA.getText("content").toString();
    const finalB = docB.getText("content").toString();

    expect(finalA).toBe(finalB);
    expect(finalA).toContain("edit from A");
    expect(finalA).toContain("offline edit from B");
    expect(Y.encodeStateAsUpdate(docA)).toEqual(Y.encodeStateAsUpdate(docB));
  });

  it("surfaces 'conflict-resolved' when a remote edit merges concurrent unsent local edits", async () => {
    wss = createSyncServer(0, { tokenSecret: TEST_SECRET });
    const port = serverPort(wss);
    const url = `ws://localhost:${port}/conflict-room`;

    // A's debounce is long so its local edit stays *pending* (unsent) while
    // B's edit arrives — that's exactly the concurrent-edit window the
    // conflict-resolved status is meant to surface. B flushes fast.
    const docA = new Y.Doc();
    const docB = new Y.Doc();
    const engineA = createSyncEngine({
      doc: docA,
      url,
      getToken: getToken("conflict-room"),
      debounceMs: 1000,
      conflictResolvedMs: 300,
    });
    const engineB = createSyncEngine({
      doc: docB,
      url,
      getToken: getToken("conflict-room"),
      debounceMs: 10,
    });
    engines.push(engineA, engineB);

    await waitFor(() => engineA.getStatus() === "online");
    await waitFor(() => engineB.getStatus() === "online");

    // A types (edit is now queued locally, held by the 1s debounce)...
    docA.getText("content").insert(0, "A's local edit ");
    expect(engineA.getStatus()).toBe("syncing");

    // ...and before A's debounce flushes, B's concurrent edit arrives and
    // Yjs merges it into A's doc. A's engine should flag conflict-resolved.
    docB.getText("content").insert(0, "B's remote edit ");
    await waitFor(() => engineA.getStatus() === "conflict-resolved", 3000);

    // it's transient: after conflictResolvedMs it settles back to a steady
    // state (still syncing here, since A's local edit is still pending)
    await waitFor(() => engineA.getStatus() !== "conflict-resolved", 3000);
    expect(engineA.getStatus()).toBe("syncing");

    // and the merge itself is lossless — both edits survive on both sides
    await waitFor(() => docB.getText("content").toString().includes("A's local edit"), 3000);
    expect(docA.getText("content").toString()).toContain("A's local edit");
    expect(docA.getText("content").toString()).toContain("B's remote edit");
    expect(Y.encodeStateAsUpdate(docA)).toEqual(Y.encodeStateAsUpdate(docB));
  });
});
