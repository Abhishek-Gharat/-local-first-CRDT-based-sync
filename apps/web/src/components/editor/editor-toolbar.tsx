"use client";

import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  TextQuote,
  SquareCode,
  Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface EditorToolbarProps {
  editor: Editor;
}

interface ToolbarItem {
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  isActive: (editor: Editor) => boolean;
  run: (editor: Editor) => void;
}

// Grouped the way editors conventionally group them: inline marks, block
// types, then structure. Every action goes through the same chain()->focus()
// so the selection never gets lost to a toolbar click.
const GROUPS: ToolbarItem[][] = [
  [
    {
      label: "Bold",
      icon: Bold,
      isActive: (e) => e.isActive("bold"),
      run: (e) => e.chain().focus().toggleBold().run(),
    },
    {
      label: "Italic",
      icon: Italic,
      isActive: (e) => e.isActive("italic"),
      run: (e) => e.chain().focus().toggleItalic().run(),
    },
    {
      label: "Strikethrough",
      icon: Strikethrough,
      isActive: (e) => e.isActive("strike"),
      run: (e) => e.chain().focus().toggleStrike().run(),
    },
    {
      label: "Inline code",
      icon: Code,
      isActive: (e) => e.isActive("code"),
      run: (e) => e.chain().focus().toggleCode().run(),
    },
  ],
  [
    {
      label: "Heading 1",
      icon: Heading1,
      isActive: (e) => e.isActive("heading", { level: 1 }),
      run: (e) => e.chain().focus().toggleHeading({ level: 1 }).run(),
    },
    {
      label: "Heading 2",
      icon: Heading2,
      isActive: (e) => e.isActive("heading", { level: 2 }),
      run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      label: "Heading 3",
      icon: Heading3,
      isActive: (e) => e.isActive("heading", { level: 3 }),
      run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(),
    },
  ],
  [
    {
      label: "Bullet list",
      icon: List,
      isActive: (e) => e.isActive("bulletList"),
      run: (e) => e.chain().focus().toggleBulletList().run(),
    },
    {
      label: "Numbered list",
      icon: ListOrdered,
      isActive: (e) => e.isActive("orderedList"),
      run: (e) => e.chain().focus().toggleOrderedList().run(),
    },
    {
      label: "Blockquote",
      icon: TextQuote,
      isActive: (e) => e.isActive("blockquote"),
      run: (e) => e.chain().focus().toggleBlockquote().run(),
    },
    {
      label: "Code block",
      icon: SquareCode,
      isActive: (e) => e.isActive("codeBlock"),
      run: (e) => e.chain().focus().toggleCodeBlock().run(),
    },
    {
      label: "Divider",
      icon: Minus,
      isActive: () => false,
      run: (e) => e.chain().focus().setHorizontalRule().run(),
    },
  ],
];

/**
 * Formatting toolbar for the collaborative editor. `useEditorState` keeps the
 * active-state highlighting in sync with the selection without re-rendering
 * the whole editor component on every transaction.
 */
export function EditorToolbar({ editor }: EditorToolbarProps) {
  // one boolean per item, recomputed only when the editor state changes
  const activeStates = useEditorState({
    editor,
    selector: ({ editor: e }) => GROUPS.map((group) => group.map((item) => item.isActive(e))),
  });

  return (
    <div
      role="toolbar"
      aria-label="Text formatting"
      className="flex flex-wrap items-center gap-0.5 border-b border-border/70 pb-2"
    >
      {GROUPS.map((group, gi) => (
        <div key={gi} className="flex items-center gap-0.5">
          {gi > 0 && <span aria-hidden className="mx-1.5 h-4 w-px bg-border" />}
          {group.map((item, ii) => {
            const Icon = item.icon;
            const active = activeStates?.[gi]?.[ii] ?? false;
            return (
              <button
                key={item.label}
                type="button"
                title={item.label}
                aria-label={item.label}
                aria-pressed={active}
                onClick={() => item.run(editor)}
                className={cn(
                  "flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  active && "bg-primary/10 text-primary",
                )}
              >
                <Icon aria-hidden className="size-4" />
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
