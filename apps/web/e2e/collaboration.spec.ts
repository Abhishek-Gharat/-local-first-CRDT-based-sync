import { test, expect } from "@playwright/test";
import {
  makeUser,
  registerAndLogin,
  createDocument,
  editorLocator,
  typeInEditor,
} from "./helpers";

// The assignment's first two headline criteria, exercised through real
// browsers over a real WebSocket (not simulated Y.Docs): live collaboration
// between two tabs, and offline-edit → reconnect → convergence with zero data
// loss. Both tabs belong to the same owner here so no sharing setup is needed;
// RBAC across distinct users is covered separately in rbac.spec.ts.
test.describe("collaborative editing", () => {
  test("propagates a live edit from one tab to another", async ({ context, page }) => {
    const owner = makeUser("live-owner");
    await registerAndLogin(page, owner);
    const documentId = await createDocument(page);

    // Second tab, same session, same document.
    const second = await context.newPage();
    await second.goto(`/documents/${documentId}`);
    await expect(editorLocator(second)).toBeVisible();

    // Wait for both tabs to report a live connection so the edit isn't sent
    // before the socket is open (which would still converge, but slower and
    // less deterministic to assert on).
    await expect(page.getByRole("status")).toContainText(/connected|sync/i);

    await typeInEditor(page, "hello from tab one");

    // The second tab should receive it over the wire without a reload.
    await expect(editorLocator(second)).toContainText("hello from tab one");
  });

  test("converges an offline edit on reconnect with no data loss", async ({
    context,
    page,
  }) => {
    const owner = makeUser("offline-owner");
    await registerAndLogin(page, owner);
    const documentId = await createDocument(page);

    const second = await context.newPage();
    await second.goto(`/documents/${documentId}`);
    await expect(editorLocator(second)).toBeVisible();

    // Establish a baseline both tabs agree on.
    await typeInEditor(page, "shared baseline. ");
    await expect(editorLocator(second)).toContainText("shared baseline.");

    // Take the second tab offline at the browser level — the local-first
    // layer must keep accepting edits with no network.
    await second.context().setOffline(true);
    await typeInEditor(second, "typed while offline. ");
    // The offline tab shows its own edit immediately (local-first).
    await expect(editorLocator(second)).toContainText("typed while offline.");

    // Meanwhile the online tab makes a concurrent edit the offline tab hasn't
    // seen yet — this is the real conflict case, not just a queued replay.
    await typeInEditor(page, "typed while peer was offline. ");

    // Reconnect. Yjs should merge both directions: neither edit is lost, and
    // both tabs converge to identical content.
    await second.context().setOffline(false);

    const offlineFragment = "typed while offline.";
    const onlineFragment = "typed while peer was offline.";

    // Both tabs must end up containing both concurrent edits.
    await expect(editorLocator(second)).toContainText(offlineFragment);
    await expect(editorLocator(second)).toContainText(onlineFragment);
    await expect(editorLocator(page)).toContainText(offlineFragment);
    await expect(editorLocator(page)).toContainText(onlineFragment);

    // And converge to exactly the same text (order-independent CRDT merge).
    await expect
      .poll(async () => (await editorLocator(page).innerText()).trim())
      .toBe((await editorLocator(second).innerText()).trim());
  });
});
