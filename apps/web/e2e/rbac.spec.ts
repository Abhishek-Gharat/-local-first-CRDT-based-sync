import { test, expect } from "@playwright/test";
import {
  makeUser,
  registerUser,
  registerAndLogin,
  login,
  createDocument,
  addMember,
  editorLocator,
} from "./helpers";

// The assignment's third headline criterion: a viewer cannot write, and that
// isn't just a hidden button — it's enforced at the wire-protocol level by the
// sync-server. Here we drive it end to end: the owner shares a doc as viewer,
// the viewer signs in, sees the content but a non-editable surface, and a
// forced programmatic edit still doesn't propagate back to the owner.
test.describe("role-based access control", () => {
  test("a viewer sees content but cannot mutate the shared document", async ({
    browser,
    page,
  }) => {
    const owner = makeUser("rbac-owner");
    const viewer = makeUser("rbac-viewer");

    // Owner creates and writes to a document.
    await registerAndLogin(page, owner);
    const documentId = await createDocument(page);
    await editorLocator(page).click();
    await editorLocator(page).pressSequentially("owner authored this line");
    await expect(editorLocator(page)).toContainText("owner authored this line");

    // Register the viewer and grant them viewer access via the members API.
    await registerUser(page, viewer);
    await addMember(page, documentId, viewer.email, "viewer");

    // Viewer signs in from a separate browser context and opens the doc.
    const viewerContext = await browser.newContext();
    const viewerPage = await viewerContext.newPage();
    await login(viewerPage, viewer);
    await viewerPage.goto(`/documents/${documentId}`);

    // They can read the owner's content...
    await expect(editorLocator(viewerPage)).toContainText("owner authored this line");
    // ...and their role is surfaced.
    await expect(viewerPage.getByText(/viewer/i).first()).toBeVisible();

    // The editing surface is non-editable for a viewer (UX layer).
    await expect(editorLocator(viewerPage)).toHaveAttribute("contenteditable", "false");

    // Security layer: even forcing the contenteditable flag on and typing must
    // not mutate the shared doc — the sync-server rejects viewer writes at the
    // wire level, so the owner never sees the injected text.
    await viewerPage.evaluate(() => {
      const el = document.querySelector<HTMLElement>(".ProseMirror");
      el?.setAttribute("contenteditable", "true");
      el?.focus();
    });
    await editorLocator(viewerPage).pressSequentially("VIEWER TAMPERED");

    // Give any (rejected) frame time to round-trip. The owner's document must
    // remain exactly what the owner wrote.
    await viewerPage.waitForTimeout(1_500);
    await expect(editorLocator(page)).not.toContainText("VIEWER TAMPERED");
    await expect(editorLocator(page)).toContainText("owner authored this line");

    await viewerContext.close();
  });
});
