"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import type * as Y from "yjs";

interface CollaborativeEditorProps {
  doc: Y.Doc;
  /**
   * UX-only: hides the caret/keyboard input for viewer-role users. This is
   * not the security boundary — sync-server's message-guard (M7) rejects
   * viewer writes at the wire-protocol level regardless of what this prop
   * is set to, so a tampered client still can't actually mutate the doc.
   */
  editable?: boolean;
}

// undoRedo is disabled on StarterKit here on purpose: the Collaboration
// extension tracks history against the shared Yjs doc itself, so
// ProseMirror's own undo stack would fight it and desync from what other
// collaborators see.
export function CollaborativeEditor({ doc, editable = true }: CollaborativeEditorProps) {
  const editor = useEditor({
    // Safe here: this component (and its only caller, document-editor.tsx)
    // is "use client" and never rendered during SSR, so there's no
    // hydration mismatch to guard against.
    immediatelyRender: true,
    editable,
    extensions: [
      StarterKit.configure({ undoRedo: false }),
      Collaboration.configure({ document: doc }),
    ],
  });

  return <EditorContent editor={editor} />;
}
