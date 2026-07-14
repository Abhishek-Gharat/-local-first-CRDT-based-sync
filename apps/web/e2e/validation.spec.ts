import { test, expect } from "@playwright/test";
import { makeUser, registerAndLogin, createDocument } from "./helpers";

const SYNC_SERVER_URL = "ws://localhost:1234";

// The assignment's "malformed/oversized payload rejected without crashing"
// criterion, against the *live* sync-server (not the unit harness). We mint a
// real handshake token through the authenticated API, open a browser
// WebSocket to the sync-server, and fire an oversized frame — then prove the
// server dropped that one connection and is still serving everyone else.
test.describe("sync-server payload validation", () => {
  test("rejects an oversized frame and stays up for other clients", async ({ page }) => {
    const owner = makeUser("validation-owner");
    await registerAndLogin(page, owner);
    const documentId = await createDocument(page);

    // A real, correctly-signed editor token for this document.
    const tokenResponse = await page.request.get(
      `/api/documents/${documentId}/sync-token`,
    );
    expect(tokenResponse.ok()).toBeTruthy();
    const { token } = (await tokenResponse.json()) as { token: string };

    // Open a raw WebSocket from inside the page and send 2MB of zeros —
    // over the sync-server's 1MB MAX_MESSAGE_BYTES cap. Assert the socket is
    // closed (ws' 1009 maxPayload, or the server's 4400 invalid-message).
    const closeCode = await page.evaluate(
      async ({ url, docId, tok }) => {
        return new Promise<number>((resolve, reject) => {
          const ws = new WebSocket(`${url}/${docId}?token=${tok}`);
          ws.binaryType = "arraybuffer";
          ws.onopen = () => ws.send(new Uint8Array(2 * 1024 * 1024));
          ws.onclose = (event) => resolve(event.code);
          ws.onerror = () => {
            /* close fires next; let the timeout guard handle a true hang */
          };
          setTimeout(() => reject(new Error("socket never closed")), 10_000);
        });
      },
      { url: SYNC_SERVER_URL, docId: documentId, tok: token },
    );
    expect([1009, 4400]).toContain(closeCode);

    // The server must still be alive: a fresh, well-behaved connection to the
    // same document should open and complete the sync handshake normally.
    const stillAlive = await page.evaluate(
      async ({ url, docId, tok }) => {
        return new Promise<boolean>((resolve, reject) => {
          const ws = new WebSocket(`${url}/${docId}?token=${tok}`);
          ws.binaryType = "arraybuffer";
          // Receiving any frame (the server's SyncStep1) proves it's serving.
          ws.onmessage = () => {
            ws.close();
            resolve(true);
          };
          ws.onopen = () => {
            // send a minimal, valid empty-ish message: message type 0 (sync),
            // sync-step-1 sub-type 0, then an empty state vector length.
            ws.send(new Uint8Array([0, 0, 0]));
          };
          ws.onclose = (event) => {
            // if it closed without ever serving a frame, that's a failure
            if (event.code !== 1000) reject(new Error(`closed early: ${event.code}`));
          };
          setTimeout(() => reject(new Error("no frame from live server")), 10_000);
        });
      },
      { url: SYNC_SERVER_URL, docId: documentId, tok: token },
    );
    expect(stillAlive).toBe(true);
  });
});
