"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import { Placeholder } from "@tiptap/extensions";
import { Extension } from "@tiptap/core";
import { yCursorPlugin } from "@tiptap/y-tiptap";
import type { Awareness } from "y-protocols/awareness";
import type * as Y from "yjs";
import { Bold, Italic, Strikethrough, Code, Terminal, Lightbulb } from "lucide-react";
import { EditorToolbar } from "@/components/editor/editor-toolbar";
import { EditorKeyboardShortcuts } from "@/components/editor/editor-keyboard-shortcuts";
import { FindReplace } from "@/components/editor/find-replace/find-replace-extension";
import { FindReplaceBar } from "@/components/editor/find-replace/find-replace-bar";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { lowlight } from "@/lib/editor/lowlight";
import { CodeBlockComponent } from "@/components/editor/code-block-view";
import { requestLinkPopover } from "@/components/editor/link-popover-bridge";
import { Callout } from "@/lib/editor/callout-extension";
import { SlashCommand } from "@/lib/editor/slash-command-extension";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { Highlight } from "@tiptap/extension-highlight";
import { TableFloatingMenu } from "@/components/editor/table-floating-menu";
import { ColorPickerPopover } from "@/components/editor/color-picker-popover";
import { cn } from "@/lib/utils";

const CollaborationCursor = Extension.create<{ awareness: Awareness }>({
  name: "collaborationCursor",
  addOptions() {
    return {
      awareness: null as unknown as Awareness,
    };
  },
  addProseMirrorPlugins() {
    return [yCursorPlugin(this.options.awareness)];
  },
});

interface CollaborativeEditorProps {
  doc: Y.Doc;
  awareness?: Awareness;
  /**
   * UX-only: hides the caret/keyboard input for viewer-role users. This is
   * not the security boundary — sync-server's message-guard (M7) rejects
   * viewer writes at the wire-protocol level regardless of what this prop
   * is set to, so a tampered client still can't actually mutate the doc.
   */
  editable?: boolean;
  /**
   * Reports live document statistics upward (for the status bar). Sourced
   * from the editor rather than from the Y.Doc because the collaborative
   * fragment is an XmlFragment, not a Y.Text — counting words off the raw
   * CRDT would count markup, not prose.
   */
  onStats?: (stats: { words: number; chars: number }) => void;
  /**
   * Publishes the live editor instance to the parent.
   *
   * Export lives in the application bar, but the editor instance is created
   * here, so the parent needs a handle on it. This is a callback rather than
   * lifted state on purpose: `useEditor()` must stay owned by the component
   * that also owns the CRDT wiring, and the parent only needs to *read* the
   * instance (for `getHTML()`), never drive it.
   */
  onEditor?: (editor: Editor | null) => void;
}

interface FloatingPosition {
  top: number;
  left: number;
}

function countWords(text: string): number {
  const matches = text.match(/\S+/g);
  return matches ? matches.length : 0;
}

// undoRedo is disabled on StarterKit here on purpose: the Collaboration
// extension tracks history against the shared Yjs doc itself, so
// ProseMirror's own undo stack would fight it and desync from what other
// collaborators see.
export function CollaborativeEditor({
  doc,
  awareness,
  editable = true,
  onStats,
  onEditor,
}: CollaborativeEditorProps) {
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
      handleClick: (view, _pos, event) => {
        const target = event.target as HTMLElement | null;
        const link = target?.closest("a");
        if (!link) return false;

        const href = link.getAttribute("href");
        if (!href) return false;

        // Cmd+Click / Ctrl+Click, or in viewer/read-only mode: open link directly in a new tab
        if (event.metaKey || event.ctrlKey || !editable) {
          event.preventDefault();
          window.open(href, "_blank", "noopener,noreferrer");
          return true;
        }

        // Plain click while editing: open the link popover right at the link
        window.setTimeout(() => {
          if (!view.isDestroyed) {
            requestLinkPopover();
          }
        }, 10);
        return false;
      },
    },
    extensions: [
      StarterKit.configure({
        undoRedo: false,
        codeBlock: false,
        link: {
          openOnClick: false,
          defaultProtocol: "https",
          HTMLAttributes: {
            rel: "noopener noreferrer nofollow",
            target: "_blank",
            title: "Click to view options (Ctrl+Click to open in new tab)",
          },
        },
      }),
      CodeBlockLowlight.extend({
        addNodeView() {
          return ReactNodeViewRenderer(CodeBlockComponent);
        },
      }).configure({ lowlight }),
      // Installed after StarterKit so the keymap wins over the list keymap for
      // the combinations it claims (e.g. Mod-Shift-7/8/9).
      EditorKeyboardShortcuts,
      FindReplace,
      // Task lists are registered through the dedicated extensions rather than
      // StarterKit: StarterKit has no task list support, and these two bring the
      // `taskList`/`taskItem` nodes plus `toggleTaskList`. `nested: true` allows
      // checklists to contain sub-checklists, which is what makes them usable
      // for anything beyond a flat shopping list.
      //
      // Both are plain node extensions, so they serialise into the shared Yjs
      // document like any other node — a checkbox toggle is an ordinary
      // transaction that syncs to every collaborator without special handling.
      TaskList,
      TaskItem.configure({ nested: true }),
      Callout,
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      ...(editable ? [SlashCommand] : []),
      Collaboration.configure({ document: doc }),
      ...(awareness ? [CollaborationCursor.configure({ awareness })] : []),
      Placeholder.configure({
        placeholder: editable ? "Type '/' for commands or start writing…" : "",
      }),
    ],
  });

  const surfaceRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<number | null>(null);
  const [floating, setFloating] = useState<FloatingPosition | null>(null);

  /**
   * Contextual formatting bar that tracks the current text selection.
   *
   * Implemented directly against ProseMirror's `coordsAtPos` rather than
   * pulled from an extension: it needs ~20 lines, avoids shipping a plugin
   * just for positioning, and keeps the "prevent mousedown so the editor
   * never loses its selection" behaviour explicit.
   */
  const reposition = useCallback(() => {
    if (!editor) return;
    const { state, view } = editor;
    const { empty, from, to } = state.selection;
    const surface = surfaceRef.current;

    if (empty || from === to || !surface || !editable) {
      setFloating(null);
      return;
    }

    const start = view.coordsAtPos(from);
    const end = view.coordsAtPos(to);
    const bounds = surface.getBoundingClientRect();
    const left = (Math.min(start.left, end.left) + Math.max(start.right, end.right)) / 2;
    const top = Math.min(start.top, end.top);

    setFloating({
      top: top - bounds.top - 46,
      left: Math.max(
        12,
        Math.min(left - bounds.left, bounds.width - 12),
      ),
    });
  }, [editor, editable]);

  useEffect(() => {
    if (!editor) return;

    const schedule = () => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
      reposition();
    };
    // Grace period on blur so a click on the floating bar itself (which uses
    // mousedown-preventDefault) still lands before the bar can disappear.
    const onBlur = () => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
      hideTimer.current = window.setTimeout(() => setFloating(null), 140);
    };

    editor.on("selectionUpdate", schedule);
    editor.on("transaction", schedule);
    editor.on("blur", onBlur);
    editor.on("focus", schedule);

    return () => {
      editor.off("selectionUpdate", schedule);
      editor.off("transaction", schedule);
      editor.off("blur", onBlur);
      editor.off("focus", schedule);
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    };
  }, [editor, reposition]);

  // live word/character count, recomputed per transaction via the selector
  // (no full component re-render churn while typing)
  const stats = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (!e || e.isDestroyed || !e.state?.doc) return { words: 0, chars: 0 };
      try {
        const text = e.getText();
        return { words: countWords(text), chars: text.length };
      } catch {
        return { words: 0, chars: 0 };
      }
    },
  });

  // Lift the counts to the status bar without re-rendering the editor.
  useEffect(() => {
    onStats?.(stats ?? { words: 0, chars: 0 });
  }, [stats, onStats]);

  // Publish (and withdraw) the editor instance for consumers outside the
  // writing surface, such as the application bar's export actions.
  useEffect(() => {
    onEditor?.(editor ?? null);
  }, [editor, onEditor]);

  const selectionMarks = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (!e || e.isDestroyed || !e.state?.doc) {
        return { bold: false, italic: false, strike: false, code: false, codeBlock: false };
      }
      try {
        return {
          bold: e.isActive("bold") ?? false,
          italic: e.isActive("italic") ?? false,
          strike: e.isActive("strike") ?? false,
          code: e.isActive("code") ?? false,
          codeBlock: e.isActive("codeBlock") ?? false,
        };
      } catch {
        return { bold: false, italic: false, strike: false, code: false, codeBlock: false };
      }
    },
  });

  return (
    <div ref={surfaceRef} className="relative flex flex-1 flex-col">
      {editable && editor && <EditorToolbar editor={editor} />}
      {/* Above the canvas, below the toolbar in stacking terms: `sticky` here
          pins it under the app bar while the document scrolls beneath. */}
      {editable && editor && <FindReplaceBar editor={editor} />}
      {editable && editor && <TableFloatingMenu editor={editor} />}

      <EditorContent
        editor={editor}
        className="flex flex-1 flex-col pt-5 pb-32 sm:pb-48 [&>div]:flex-1"
      />

      {/* Contextual selection toolbar */}
      {editable && editor && floating && (
        <div
          role="toolbar"
          aria-label="Selection formatting"
          style={{ top: floating.top, left: floating.left }}
          className="absolute z-30 flex -translate-x-1/2 items-center gap-0.5 rounded-lg border border-border bg-popover p-0.5 shadow-lg shadow-foreground/10"
        >
          {(
            [
              {
                label: "Bold",
                icon: Bold,
                active: selectionMarks?.bold,
                run: () => editor.chain().focus().toggleBold().run(),
              },
              {
                label: "Italic",
                icon: Italic,
                active: selectionMarks?.italic,
                run: () => editor.chain().focus().toggleItalic().run(),
              },
              {
                label: "Strikethrough",
                icon: Strikethrough,
                active: selectionMarks?.strike,
                run: () => editor.chain().focus().toggleStrike().run(),
              },
              {
                label: "Inline code",
                icon: Code,
                active: selectionMarks?.code,
                run: () => editor.chain().focus().toggleCode().run(),
              },
              {
                label: "Code block",
                icon: Terminal,
                active: selectionMarks?.codeBlock,
                run: () => editor.chain().focus().toggleCodeBlock().run(),
              },
              {
                label: "Callout box",
                icon: Lightbulb,
                active: editor.isActive("callout"),
                run: () => editor.chain().focus().toggleCallout().run(),
              },
            ] as const
          ).map((item) => (
            <button
              key={item.label}
              type="button"
              title={item.label}
              aria-label={item.label}
              aria-pressed={item.active}
              // keep the ProseMirror selection alive across the click
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                item.run();
                reposition();
              }}
              className={cn(
                "flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
                item.active && "bg-primary/12 text-primary",
              )}
            >
              <item.icon aria-hidden className="size-3.5" />
            </button>
          ))}

          <span className="mx-0.5 h-4 w-px bg-border" aria-hidden />
          <ColorPickerPopover editor={editor} />
        </div>
      )}
    </div>
  );
}
