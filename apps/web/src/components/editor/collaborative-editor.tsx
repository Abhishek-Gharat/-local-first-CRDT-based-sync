"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import type * as Y from "yjs";

interface CollaborativeEditorProps {
  doc: Y.Doc;
}

// undoRedo is disabled on StarterKit here on purpose: the Collaboration
// extension tracks history against the shared Yjs doc itself, so
// ProseMirror's own undo stack would fight it and desync from what other
// collaborators see.
export function CollaborativeEditor({ doc }: CollaborativeEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ undoRedo: false }),
      Collaboration.configure({ document: doc }),
    ],
  });

  return <EditorContent editor={editor} />;
}
