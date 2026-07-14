import * as Y from "yjs";
import { getSchema } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { yXmlFragmentToProseMirrorRootNode } from "@tiptap/y-tiptap";

// Same schema/fragment the editor and restore path use, so the text we extract
// here is exactly what the user sees — not a re-parse guess. See restore.ts for
// why Collaboration is omitted (it's a schema-less extension).
const schema = getSchema([StarterKit.configure({ undoRedo: false })]);
const FRAGMENT_NAME = "default";

// Decodes a `Y.encodeStateAsUpdate` snapshot into the document's plain text.
// Block nodes are separated by newlines so paragraph boundaries survive into
// the diff (otherwise "end of para A" and "start of para B" would merge into
// one bogus changed word).
export function snapshotToPlainText(snapshot: Uint8Array): string {
  const doc = new Y.Doc();
  try {
    Y.applyUpdate(doc, snapshot);
    const fragment = doc.getXmlFragment(FRAGMENT_NAME);
    const root = yXmlFragmentToProseMirrorRootNode(fragment, schema);
    const blocks: string[] = [];
    root.forEach((node) => {
      blocks.push(node.textContent);
    });
    return blocks.join("\n").trim();
  } finally {
    doc.destroy();
  }
}
