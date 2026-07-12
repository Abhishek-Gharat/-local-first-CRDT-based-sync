import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openLocalDoc } from "../doc-store";

// Proves this layer is genuinely local-first: fetch is stubbed to throw for
// the whole suite, so any accidental network call (not just a missing one)
// fails the test loudly instead of silently succeeding against a real host.
beforeEach(() => {
  globalThis.fetch = () => {
    throw new Error("network access is not allowed in the local-first storage layer");
  };
});

afterEach(() => {
  // @ts-expect-error -- test-only cleanup, no replacement needed between runs
  delete globalThis.fetch;
});

describe("local-first IndexedDB storage", () => {
  it("persists edits across a simulated reload of the same document", async () => {
    const docId = `test-${Math.random().toString(36).slice(2)}`;

    const first = openLocalDoc(docId);
    await first.whenSynced;
    first.doc.getText("content").insert(0, "hello offline world");
    // the update->indexeddb write is an async IDB transaction fired from a
    // doc 'update' listener with no returned promise to await directly
    await new Promise((resolve) => setTimeout(resolve, 50));
    first.destroy();

    const second = openLocalDoc(docId);
    await second.whenSynced;
    expect(second.doc.getText("content").toString()).toBe("hello offline world");
    second.destroy();
  });

  it("keeps separate documents independent", async () => {
    const docA = openLocalDoc(`test-a-${Math.random().toString(36).slice(2)}`);
    const docB = openLocalDoc(`test-b-${Math.random().toString(36).slice(2)}`);
    await Promise.all([docA.whenSynced, docB.whenSynced]);

    docA.doc.getText("content").insert(0, "doc a");
    docB.doc.getText("content").insert(0, "doc b");

    expect(docA.doc.getText("content").toString()).toBe("doc a");
    expect(docB.doc.getText("content").toString()).toBe("doc b");

    docA.destroy();
    docB.destroy();
  });
});
