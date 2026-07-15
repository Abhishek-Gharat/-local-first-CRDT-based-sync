"use client";

import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import { Placeholder } from "@tiptap/extensions";
import type * as Y from "yjs";
import { EditorToolbar } from "@/components/editor/editor-toolbar";

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

function countWords(text: string): number {
  const matches = text.match(/\S+/g);
  return matches ? matches.length : 0;
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
    editorProps: {
      // red squiggles all over a collaborative doc read as errors; the
      // browser's spellcheck adds noise, not value, in a shared canvas
      attributes: { spellcheck: "false" },
    },
    extensions: [
      StarterKit.configure({ undoRedo: false }),
      Collaboration.configure({ document: doc }),
      Placeholder.configure({
        placeholder: editable ? "Start writing — changes save locally and sync live…" : "",
      }),
    ],
  });

  // live word/character count, recomputed per transaction via the selector
  // (no full component re-render churn while typing)
  const stats = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (!e) return { words: 0, chars: 0 };
      const text = e.getText();
      return { words: countWords(text), chars: text.length };
    },
  });

  return (
    <div className="flex flex-1 flex-col gap-3">
      {editable && editor && <EditorToolbar editor={editor} />}
      <EditorContent editor={editor} className="flex flex-1 flex-col [&>div]:flex-1" />
      <p
        aria-label="Document statistics"
        className="border-t border-border/70 pt-2 text-right text-xs text-muted-foreground tabular-nums"
      >
        {stats?.words ?? 0} words · {stats?.chars ?? 0} characters
      </p>
    </div>
  );
}
