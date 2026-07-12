// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import * as Y from "yjs";

function createEditor(doc: Y.Doc) {
  return new Editor({
    extensions: [
      StarterKit.configure({ undoRedo: false }),
      Collaboration.configure({ document: doc }),
    ],
  });
}

describe("tiptap + yjs CRDT document model", () => {
  it("converges deterministically when two offline editors' edits are merged", () => {
    const docA = new Y.Doc();
    const docB = new Y.Doc();

    const editorA = createEditor(docA);
    const editorB = createEditor(docB);

    // two collaborators editing fully offline from the same empty
    // starting point — no updates exchanged yet
    editorA.commands.insertContentAt(0, "hello from A. ");
    editorB.commands.insertContentAt(0, "hello from B. ");

    // reconnect: exchange each other's updates, in opposite order on each
    // side, to prove the merge isn't order-dependent
    const updateA = Y.encodeStateAsUpdate(docA);
    const updateB = Y.encodeStateAsUpdate(docB);
    Y.applyUpdate(docB, updateA);
    Y.applyUpdate(docA, updateB);

    // deterministic convergence: both docs end up byte-identical, and both
    // editors render the same merged content — neither side's edit
    // clobbered the other's, because this is a CRDT merge, not
    // last-write-wins
    expect(Y.encodeStateAsUpdate(docA)).toEqual(Y.encodeStateAsUpdate(docB));
    expect(editorA.getText()).toBe(editorB.getText());
    expect(editorA.getText()).toContain("hello from A");
    expect(editorA.getText()).toContain("hello from B");

    editorA.destroy();
    editorB.destroy();
  });
});
