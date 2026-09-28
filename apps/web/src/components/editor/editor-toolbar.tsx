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
  CheckSquare,
  Minus,
  Pilcrow,
  MoreHorizontal,
  ChevronDown,
  Terminal,
  Lightbulb,
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
import { Button } from "@/components/ui/button";
import { LinkPopover } from "@/components/editor/link-popover";

interface EditorToolbarProps {
  editor: Editor;
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
 *   1. block type — a single labelled control that reports the *current*
 *      block, instead of three independent heading toggles the user has to
 *      decode and pick between;
 *   2. inline marks — the four things you apply to a word;
 *   3. structure — block-level insertions that are less frequent.
 *
 * Below `md` the structure group is not hidden-and-clipped, it is *moved*
 * into an overflow menu, so a phone gets a toolbar that fits rather than one
 * that wraps onto three ragged rows.
 */

// Grouped the way editors conventionally group them: inline marks, block
// types, then structure. Every action goes through the same chain()->focus()
// so the selection never gets lost to a toolbar click.
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
];

export function EditorToolbar({ editor }: EditorToolbarProps) {
  const compact = useMediaQuery("(max-width: 767px)");

  // one boolean per item, recomputed only when the editor state changes
  const activeStates = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      marks: MARKS.map((item) => item.isActive(e)),
      blocks: BLOCKS.map((item) => item.isActive(e)),
    }),
  });

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
      className="sticky top-14 z-20 flex items-center gap-1 rounded-xl border border-border bg-card/90 p-1 shadow-sm backdrop-blur-md transition-colors supports-[backdrop-filter]:bg-card/75"
    >
      {/* ── Block type: reports the current block, changes the next one ── */}
      <Popover>
        <PopoverTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              className="min-w-0 gap-1.5 px-2 font-medium text-foreground"
              aria-label={`Block type: ${currentBlock.label}`}
            />
          }
        >
          <ActiveBlockIcon aria-hidden className="size-3.5 shrink-0 text-primary" />
          <span className={cn("truncate", compact && "sr-only sm:not-sr-only")}>
            {currentBlock.label}
          </span>
          <ChevronDown aria-hidden className="size-3 shrink-0 opacity-60" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-56 p-1">
          <p className="px-2 pt-1 pb-1.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
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
                  "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
                  activeBlocks[index] && "bg-accent text-accent-foreground",
                )}
              >
                <Icon
                  aria-hidden
                  className={cn(
                    "size-3.5 shrink-0",
                    activeBlocks[index] ? "text-primary" : "text-muted-foreground",
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-1">
                    <span className="block text-xs font-medium">{block.label}</span>
                    {block.shortcut && (
                      <kbd className="rounded border border-border/70 bg-muted/80 px-1 font-mono text-[9px] text-muted-foreground">
                        {block.shortcut.join("")}
                      </kbd>
                    )}
                  </span>
                  <span className="block text-[10px] text-muted-foreground">
                    {block.description}
                  </span>
                </span>
              </button>
            );
          })}
        </PopoverContent>
      </Popover>

      <ToolbarDivider />

      {/* ── Inline marks ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-0.5">
        {MARKS.map((mark, index) => (
          <TooltipButton
            key={mark.label}
            label={mark.label}
            shortcut={mark.shortcut}
            aria-pressed={activeMarks[index] ?? false}
            onClick={() => mark.run(editor)}
            className={cn(
              "size-7",
              activeMarks[index] &&
                "bg-primary/12 text-primary hover:bg-primary/16 hover:text-primary",
            )}
          >
            <mark.icon aria-hidden className="size-3.5" />
          </TooltipButton>
        ))}

        {/* Link brings its own trigger, because opening it is a stateful
            operation (add vs. edit vs. view) rather than a single command —
            and it is the same popover ⌘K opens. */}
        <LinkPopover editor={editor} />
      </div>

      <ToolbarDivider />

      {/* ── Structure: inline on wide, overflow menu on narrow ───────── */}
      {compact ? (
        <Popover>
          <PopoverTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className="size-7"
                aria-label="More formatting options"
              />
            }
          >
            <MoreHorizontal aria-hidden className="size-3.5" />
          </PopoverTrigger>
          <PopoverContent align="start" className="w-52 p-1">
            {BLOCKS.filter((block) => !block.isActive(editor)).map((block) => {
              const Icon = block.icon;
              return (
                <button
                  key={block.label}
                  type="button"
                  onClick={() => block.run(editor)}
                  className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <Icon aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-medium">{block.label}</span>
                    <span className="block text-[10px] text-muted-foreground">
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
                className={cn(
                  "size-7",
                  activeBlocks[index] &&
                    "bg-primary/12 text-primary hover:bg-primary/16 hover:text-primary",
                )}
              >
                <block.icon aria-hidden className="size-3.5" />
              </TooltipButton>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ToolbarDivider() {
  return <span aria-hidden className="mx-0.5 h-4 w-px shrink-0 bg-border" />;
}
