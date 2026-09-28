// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import "fake-indexeddb/auto";
import {
  DuplicateError,
  createDocumentCopy,
  duplicateTitle,
  readCachedDocumentUpdate,
} from "../duplicate";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("duplicateTitle", () => {
  it("prefixes the title", () => {
    expect(duplicateTitle("Q3 roadmap")).toBe("Copy of Q3 roadmap");
  });

  it("does not stack prefixes when duplicating a copy", () => {
    expect(duplicateTitle("Copy of Q3 roadmap")).toBe("Copy of Q3 roadmap");
    expect(duplicateTitle("Copy of Copy of Q3 roadmap")).toBe(
      "Copy of Q3 roadmap",
    );
  });

  it("respects the 200-character API limit", () => {
    const result = duplicateTitle("a".repeat(200));
    expect(result.length).toBe(200);
    expect(result.startsWith("Copy of ")).toBe(true);
  });

  it("falls back for an empty title", () => {
    expect(duplicateTitle("")).toBe("Copy of Untitled document");
    expect(duplicateTitle("   ")).toBe("Copy of Untitled document");
    expect(duplicateTitle("Copy of ")).toBe("Copy of Untitled document");
  });
});

describe("createDocumentCopy", () => {
  it("POSTs the prefixed title and returns the new document", async () => {
    let seenUrl: string | undefined;
    let seenBody: unknown;
    const fetchImpl = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        seenUrl = String(input);
        seenBody = JSON.parse(String(init?.body));
        return Response.json(
          { document: { id: "new-1", title: "Copy of Doc" } },
          { status: 201 },
        );
      },
    );

    const created = await createDocumentCopy({ title: "Doc", fetchImpl });

    expect(created).toEqual({ id: "new-1", title: "Copy of Doc" });
    expect(seenUrl).toBe("/api/documents");
    expect(seenBody).toEqual({ title: "Copy of Doc" });
  });

  it("raises a user-facing error on an expired session", async () => {
    const fetchImpl = vi.fn(async () => Response.json({}, { status: 401 }));
    await expect(
      createDocumentCopy({ title: "Doc", fetchImpl }),
    ).rejects.toThrow(DuplicateError);
    await expect(
      createDocumentCopy({ title: "Doc", fetchImpl }),
    ).rejects.toThrow(/session expired/i);
  });

  it("raises a user-facing error when the network fails", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    await expect(
      createDocumentCopy({ title: "Doc", fetchImpl }),
    ).rejects.toThrow(/could not reach the server/i);
  });

  it("rejects a malformed success body rather than returning undefined", async () => {
    const fetchImpl = vi.fn(async () => Response.json({}, { status: 201 }));
    await expect(
      createDocumentCopy({ title: "Doc", fetchImpl }),
    ).rejects.toThrow(/did not return a document/i);
  });
});

describe("readCachedDocumentUpdate", () => {
  // Each test needs its own database so one document's cached state cannot
  // leak into the next.
  let counter = 0;

  beforeEach(() => {
    counter += 1;
  });

  it("returns null for a document this device has never seen", async () => {
    const update = await readCachedDocumentUpdate(`never-opened-${counter}`);
    expect(update).toBeNull();
  });

  it("returns the cached state for a document that was opened here", async () => {
    const documentId = `cached-${counter}`;
    // Simulate a document previously opened on this device. The collaborative
    // fragment is an XmlFragment, so the nodes have to be real Y.Xml* values —
    // inserting a plain object would serialise as "[object Object]".
    const source = new Y.Doc();
    const paragraph = new Y.XmlElement("paragraph");
    paragraph.insert(0, [new Y.XmlText("cached content")]);
    source.getXmlFragment("default").insert(0, [paragraph]);

    const { IndexeddbPersistence } = await import("y-indexeddb");
    const writer = new IndexeddbPersistence(`docsync:${documentId}`, source);
    await writer.whenSynced;
    // Give the persistence a tick to flush the write.
    await new Promise((resolve) => setTimeout(resolve, 50));
    writer.destroy();
    source.destroy();

    const update = await readCachedDocumentUpdate(documentId);
    expect(update).toBeInstanceOf(Uint8Array);

    // The returned update must actually carry the content.
    const restored = new Y.Doc();
    Y.applyUpdate(restored, update!);
    expect(restored.getXmlFragment("default").toString()).toContain(
      "cached content",
    );
    restored.destroy();
  });
});
