import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";

export interface LocalDocHandle {
  doc: Y.Doc;
  persistence: IndexeddbPersistence;
  /** Resolves once the doc's prior local state (if any) has loaded from IndexedDB. */
  whenSynced: Promise<void>;
  destroy(): void;
}

// One Y.Doc + IndexedDB-backed persistence per document id. Every read/write
// here goes through y-indexeddb, so opening, editing, and closing a document
// never makes a network call — this is the local-first storage layer the
// sync engine (M5) and editor (M4) both build on top of.
export function openLocalDoc(documentId: string): LocalDocHandle {
  const doc = new Y.Doc();
  const persistence = new IndexeddbPersistence(`docsync:${documentId}`, doc);

  return {
    doc,
    persistence,
    whenSynced: persistence.whenSynced.then(() => undefined),
    destroy() {
      persistence.destroy();
      doc.destroy();
    },
  };
}
