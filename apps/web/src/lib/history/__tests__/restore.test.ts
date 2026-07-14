// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import * as Y from "yjs";
import { restoreSnapshotIntoDoc } from "../restore";

function createEditor(doc: Y.Doc) {
  return new Editor({
    extensions: [
      StarterKit.configure({ undoRedo: false }),
      Collaboration.configure({ document: doc }),
    ],
  });
}

describe("restoreSnapshotIntoDoc", () => {
  it("restores as a new forward op — never loses a collaborator's concurrent unsynced edit", () => {
    const docA = new Y.Doc();
    const editorA = createEditor(docA);
    editorA.commands.setContent("hello world");

    // this is the "version" a user will later choose to restore to
    const snapshot = Y.encodeStateAsUpdate(docA);
    const stateVectorAtSnapshot = Y.encodeStateVector(docA);

    // A keeps editing after the snapshot was captured
    editorA.commands.focus("end");
    editorA.commands.insertContent(" plus more edits");
    expect(editorA.getText()).toBe("hello world plus more edits");

    // a second collaborator (B) forked from the doc at the snapshot point
    // and made their own edit fully offline — it never synced with A's
    // "plus more edits" change, and still hasn't synced by the time the
    // restore below runs
    const docB = new Y.Doc();
    Y.applyUpdate(docB, snapshot);
    const editorB = createEditor(docB);
    editorB.commands.focus("end");
    editorB.commands.insertContent(" [B's concurrent edit]");

    // restore the old snapshot into A while B's edit is still unsynced
    restoreSnapshotIntoDoc(docA, snapshot);

    // content visibly reverted...
    expect(editorA.getText()).not.toContain("plus more edits");
    expect(editorA.getText()).toContain("hello world");

    // ...but not by rewinding history: A's state vector only ever grows
    // across the restore, proving it landed as new forward ops (a diff
    // applied in a fresh transaction), not Y.applyUpdate(docA, snapshot)
    // replaying old ops or any other destructive rewrite of A's state
    const decodedBefore = Y.decodeStateVector(stateVectorAtSnapshot);
    const decodedAfter = Y.decodeStateVector(Y.encodeStateVector(docA));
    expect(Y.encodeStateVector(docA)).not.toEqual(stateVectorAtSnapshot);
    for (const [client, clockAtSnapshot] of decodedBefore) {
      expect(decodedAfter.get(client) ?? 0).toBeGreaterThanOrEqual(clockAtSnapshot);
    }

    // B now reconnects and syncs its pending edit in, same as any normal
    // CRDT merge — no special-casing needed on B's side because the
    // restore never touched B's state, it only appended new ops to A
    const updateFromB = Y.encodeStateAsUpdate(docB, stateVectorAtSnapshot);
    Y.applyUpdate(docA, updateFromB);

    expect(editorA.getText()).toContain("[B's concurrent edit]");

    editorA.destroy();
    editorB.destroy();
  });
});
