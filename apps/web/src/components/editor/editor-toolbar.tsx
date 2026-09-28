"use client";

import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import {
  Undo2,
  Redo2,
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
  CheckSquare,
  Minus,
  Pilcrow,
  MoreHorizontal,
  ChevronDown,
  Terminal,
  Lightbulb,
  Table as TableIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TooltipButton } from "@/components/ui/tooltip-button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useIsMac } from "@/lib/keyboard/use-is-mac";
import { Button } from "@/components/ui/button";
import { LinkPopover } from "@/components/editor/link-popover";
import { ColorPickerPopover } from "@/components/editor/color-picker-popover";

interface EditorToolbarProps {
  editor: Editor;
  className?: string;
}

interface MarkItem {
  label: string;
  icon: LucideIcon;
  isActive: (editor: Editor) => boolean;
  run: (editor: Editor) => void;
  shortcut?: string[];
}

interface BlockItem {
  label: string;
  description: string;
  icon: LucideIcon;
  isActive: (editor: Editor) => boolean;
  run: (editor: Editor) => void;
  shortcut?: string[];
}

/**
 * Structured formatting toolbar.
 *
 * Three concerns, three groups, in the order writers reach for them:
 *   1. history — undo/redo;
 *   2. block type — a single labelled control that reports the current block;
 *   3. inline marks — the formatting applied to words;
 *   4. structure — block-level insertions (lists, tables, code).
 */
const MARKS: MarkItem[] = [
  {
    label: "Bold",
    icon: Bold,
    isActive: (e) => e.isActive("bold"),
    run: (e) => e.chain().focus().toggleBold().run(),
    shortcut: ["⌘", "B"],
  },
  {
    label: "Italic",
    icon: Italic,
    isActive: (e) => e.isActive("italic"),
    run: (e) => e.chain().focus().toggleItalic().run(),
    shortcut: ["⌘", "I"],
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
];

const BLOCKS: BlockItem[] = [
  {
    label: "Paragraph",
    description: "Body text",
    icon: Pilcrow,
    isActive: (e) => e.isActive("paragraph"),
    run: (e) => e.chain().focus().setParagraph().run(),
  },
  {
    label: "Heading 1",
    description: "Section title",
    icon: Heading1,
    isActive: (e) => e.isActive("heading", { level: 1 }),
    run: (e) => e.chain().focus().toggleHeading({ level: 1 }).run(),
    shortcut: ["#"],
  },
  {
    label: "Heading 2",
    description: "Subsection",
    icon: Heading2,
    isActive: (e) => e.isActive("heading", { level: 2 }),
    run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
    shortcut: ["##"],
  },
  {
    label: "Heading 3",
    description: "Minor heading",
    icon: Heading3,
    isActive: (e) => e.isActive("heading", { level: 3 }),
    run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(),
    shortcut: ["###"],
  },
  {
    label: "Bullet list",
    description: "Unordered list",
    icon: List,
    isActive: (e) => e.isActive("bulletList"),
    run: (e) => e.chain().focus().toggleBulletList().run(),
    shortcut: ["-"],
  },
  {
    label: "Numbered list",
    description: "Ordered steps",
    icon: ListOrdered,
    isActive: (e) => e.isActive("orderedList"),
    run: (e) => e.chain().focus().toggleOrderedList().run(),
    shortcut: ["1."],
  },
  {
    label: "Blockquote",
    description: "Quoted passage",
    icon: TextQuote,
    isActive: (e) => e.isActive("blockquote"),
    run: (e) => e.chain().focus().toggleBlockquote().run(),
    shortcut: [">"],
  },
  {
    label: "Code block",
    description: "Syntax-highlighted terminal",
    icon: Terminal,
    isActive: (e) => e.isActive("codeBlock"),
    run: (e) => e.chain().focus().toggleCodeBlock().run(),
    shortcut: ["```"],
  },
  {
    label: "Callout box",
    description: "Tinted note or warning",
    icon: Lightbulb,
    isActive: (e) => e.isActive("callout"),
    run: (e) => e.chain().focus().toggleCallout().run(),
    shortcut: ["note"],
  },
  {
    label: "Divider",
    description: "Horizontal rule",
    icon: Minus,
    isActive: () => false,
    run: (e) => e.chain().focus().setHorizontalRule().run(),
    shortcut: ["---"],
  },
  {
    label: "Task list",
    description: "Interactive checklist",
    icon: CheckSquare,
    isActive: (e) => e.isActive("taskList"),
    run: (e) => e.chain().focus().toggleTaskList().run(),
    shortcut: ["[]"],
  },
  {
    label: "Table",
    description: "Grid with rows and columns",
    icon: TableIcon,
    isActive: (e) => e.isActive("table"),
    run: (e) =>
      e
        .chain()
        .focus()
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run(),
    shortcut: ["grid"],
  },
];

export function EditorToolbar({ editor, className }: EditorToolbarProps) {
  const isMac = useIsMac();
  const compact = useMediaQuery("(max-width: 960px)");

  // one boolean per item, recomputed only when the editor state changes
  const activeStates = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (!e) {
        return {
          canUndo: false,
          canRedo: false,
          marks: MARKS.map(() => false),
          blocks: BLOCKS.map(() => false),
        };
      }
      return {
        canUndo: typeof e.can === "function" ? e.can().undo() : false,
        canRedo: typeof e.can === "function" ? e.can().redo() : false,
        marks: MARKS.map((item) => item.isActive(e)),
        blocks: BLOCKS.map((item) => item.isActive(e)),
      };
    },
  });

  if (!editor) return null;

  const canUndo = activeStates?.canUndo ?? false;
  const canRedo = activeStates?.canRedo ?? false;
  const activeBlockIndex = activeStates?.blocks.findIndex(Boolean) ?? -1;
  const currentBlock =
    activeBlockIndex >= 0 ? BLOCKS[activeBlockIndex]! : BLOCKS[0]!;
  const ActiveBlockIcon = currentBlock.icon;

  const activeMarks = activeStates?.marks ?? MARKS.map(() => false);
  const activeBlocks = activeStates?.blocks ?? BLOCKS.map(() => false);

  return (
    <div
      role="toolbar"
      aria-label="Text formatting"
      aria-orientation="horizontal"
      className={cn(
        "flex w-full items-center justify-between gap-1 overflow-x-auto py-0.5 no-scrollbar",
        className,
      )}
    >
      <div className="flex items-center gap-1">
        {/* ── History (Undo / Redo) ── */}
        <div className="flex items-center gap-0.5">
          <TooltipButton
            label="Undo"
            shortcut={isMac ? ["⌘", "Z"] : ["Ctrl", "Z"]}
            disabled={!canUndo}
            onClick={() => editor.chain().focus().undo().run()}
            aria-label="Undo"
            size="icon"
            className="size-8 sm:size-8.5 rounded-lg text-foreground/80 hover:text-foreground"
          >
            <Undo2 aria-hidden className="size-4" />
          </TooltipButton>

          <TooltipButton
            label="Redo"
            shortcut={isMac ? ["⌘", "⇧", "Z"] : ["Ctrl", "Y"]}
            disabled={!canRedo}
            onClick={() => editor.chain().focus().redo().run()}
            aria-label="Redo"
            size="icon"
            className="size-8 sm:size-8.5 rounded-lg text-foreground/80 hover:text-foreground"
          >
            <Redo2 aria-hidden className="size-4" />
          </TooltipButton>
        </div>

        <ToolbarDivider />

        {/* ── Block type: reports the current block, changes the next one ── */}
        <Popover>
          <PopoverTrigger
            render={
              <Button
                variant="ghost"
                size="sm"
                className="h-8 sm:h-8.5 min-w-0 gap-2 px-2.5 font-semibold text-foreground text-xs sm:text-sm"
                aria-label={`Block type: ${currentBlock.label}`}
              />
            }
          >
            <ActiveBlockIcon aria-hidden className="size-4 shrink-0 text-primary" />
            <span className={cn("truncate font-medium text-xs sm:text-sm", compact && "sr-only sm:not-sr-only")}>
              {currentBlock.label}
            </span>
            <ChevronDown aria-hidden className="size-3.5 shrink-0 opacity-60" />
          </PopoverTrigger>
          <PopoverContent align="start" className="w-60 p-1.5 shadow-lg">
            <p className="px-2.5 pt-1.5 pb-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              Turn into
            </p>
            {BLOCKS.map((block, index) => {
              const Icon = block.icon;
              return (
                <button
                  key={block.label}
                  type="button"
                  onClick={() => block.run(editor)}
                  aria-pressed={activeBlocks[index] ?? false}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
                    activeBlocks[index] && "bg-accent text-accent-foreground",
                  )}
                >
                  <Icon
                    aria-hidden
                    className={cn(
                      "size-4 shrink-0",
                      activeBlocks[index] ? "text-primary" : "text-muted-foreground",
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-1">
                      <span className="block text-sm font-semibold">{block.label}</span>
                      {block.shortcut && (
                        <kbd className="rounded border border-border/80 bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">
                          {block.shortcut.join("")}
                        </kbd>
                      )}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {block.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </PopoverContent>
        </Popover>

        <ToolbarDivider />

        {/* ── Inline marks ── */}
        <div className="flex items-center gap-0.5">
          {MARKS.map((mark, index) => (
            <TooltipButton
              key={mark.label}
              label={mark.label}
              shortcut={mark.shortcut}
              aria-pressed={activeMarks[index] ?? false}
              onClick={() => mark.run(editor)}
              size="icon"
              className={cn(
                "size-8 sm:size-8.5 rounded-lg text-foreground/80 hover:text-foreground",
                activeMarks[index] &&
                  "bg-primary/12 text-primary hover:bg-primary/16 hover:text-primary",
              )}
            >
              <mark.icon aria-hidden className="size-4" />
            </TooltipButton>
          ))}

          {/* Link popover trigger */}
          <LinkPopover editor={editor} />

          {/* Color & highlight picker */}
          <ColorPickerPopover editor={editor} />
        </div>
      </div>

      {/* ── Structure / Blocks: full row on wide, collapsed menu on narrow ── */}
      <div className="flex items-center gap-1">
        <ToolbarDivider />
        {compact ? (
          <Popover>
            <PopoverTrigger
              render={
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 sm:h-8.5 gap-1.5 px-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
                  aria-label="More formatting options"
                />
              }
            >
              <MoreHorizontal aria-hidden className="size-4" />
              <span className="hidden sm:inline">Insert</span>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 p-1.5 shadow-lg">
              <p className="px-2.5 pt-1.5 pb-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                Insert element
              </p>
              {BLOCKS.slice(4).map((block) => {
                const Icon = block.icon;
                return (
                  <button
                    key={block.label}
                    type="button"
                    onClick={() => block.run(editor)}
                    className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{block.label}</span>
                      <span className="block text-xs text-muted-foreground">
                        {block.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </PopoverContent>
          </Popover>
        ) : (
          <div className="flex items-center gap-0.5">
            {BLOCKS.slice(4).map((block) => {
              const index = BLOCKS.indexOf(block);
              return (
                <TooltipButton
                  key={block.label}
                  label={block.label}
                  shortcut={block.shortcut}
                  aria-pressed={activeBlocks[index] ?? false}
                  onClick={() => block.run(editor)}
                  size="icon"
                  className={cn(
                    "size-8 sm:size-8.5 rounded-lg text-foreground/80 hover:text-foreground",
                    activeBlocks[index] &&
                      "bg-primary/12 text-primary hover:bg-primary/16 hover:text-primary",
                  )}
                >
                  <block.icon aria-hidden className="size-4" />
                </TooltipButton>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ToolbarDivider() {
  return <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-border" />;
}
