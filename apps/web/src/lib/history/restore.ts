import * as Y from "yjs";
import { getSchema } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { updateYFragment, yXmlFragmentToProseMirrorRootNode } from "@tiptap/y-tiptap";

// Matches the extensions collaborative-editor.tsx builds its editor with,
// minus Collaboration itself — Collaboration is a plain Extension (no
// nodes/marks), so it doesn't affect the schema, and instantiating it here
// would need a live Y.Doc, which this module never constructs itself (it
// always operates on a doc handed to it by the caller).
const schema = getSchema([StarterKit.configure({ undoRedo: false })]);

// Same fragment name @tiptap/extension-collaboration defaults `field` to.
const FRAGMENT_NAME = "default";

/**
 * Restores `snapshot` (a `Y.encodeStateAsUpdate` blob captured earlier) into
 * `liveDoc` — NOT by replaying the snapshot's ops with `Y.applyUpdate`
 * (which would just append old history and fight whatever collaborators
 * have written since), but by diffing the snapshot's content against the
 * live document's current content and applying only that diff as a new
 * forward transaction. Other connected clients receive this the same way
 * they receive any other edit: as a normal Yjs update over the sync
 * connection, not a destructive overwrite of their local state.
 */
export function restoreSnapshotIntoDoc(liveDoc: Y.Doc, snapshot: Uint8Array): void {
  const scratchDoc = new Y.Doc();
  try {
    Y.applyUpdate(scratchDoc, snapshot);
    const snapshotFragment = scratchDoc.getXmlFragment(FRAGMENT_NAME);
    const restoredNode = yXmlFragmentToProseMirrorRootNode(snapshotFragment, schema);

    const liveFragment = liveDoc.getXmlFragment(FRAGMENT_NAME);
    updateYFragment(liveDoc, liveFragment, restoredNode, {
      mapping: new Map(),
      isOMark: new Map(),
    });
  } finally {
    scratchDoc.destroy();
  }
}
