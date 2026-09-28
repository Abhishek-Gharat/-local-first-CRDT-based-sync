import { Extension, type Editor, type Range } from "@tiptap/core";
import Suggestion, {
  type SuggestionOptions,
  type SuggestionProps,
  type SuggestionKeyDownProps,
} from "@tiptap/suggestion";
import { ReactRenderer } from "@tiptap/react";
import {
  Heading1,
  Heading2,
  Heading3,
  Pilcrow,
  Terminal,
  Lightbulb,
  CheckSquare,
  List,
  ListOrdered,
  TextQuote,
  Minus,
  Table as TableIcon,
  type LucideIcon,
} from "lucide-react";
import { SlashCommandList, type SlashCommandRef } from "@/components/editor/slash-command-menu";

export interface SlashCommandItem {
  title: string;
  description: string;
  category: "Basic blocks" | "Technical & Documentation" | "Lists & Structure";
  icon: LucideIcon;
  badge?: string;
  aliases: string[];
  command: (params: { editor: Editor; range: Range }) => void;
}

export const SLASH_COMMANDS: SlashCommandItem[] = [
  // ── Basic blocks
  {
    title: "Text",
    description: "Plain body text paragraph",
    category: "Basic blocks",
    icon: Pilcrow,
    aliases: ["p", "paragraph", "normal"],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setParagraph().run();
    },
  },
  {
    title: "Heading 1",
    description: "Large top-level section title",
    category: "Basic blocks",
    icon: Heading1,
    badge: "#",
    aliases: ["h1", "title", "header 1"],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleHeading({ level: 1 }).run();
    },
  },
  {
    title: "Heading 2",
    description: "Medium subsection heading",
    category: "Basic blocks",
    icon: Heading2,
    badge: "##",
    aliases: ["h2", "sub", "header 2"],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleHeading({ level: 2 }).run();
    },
  },
  {
    title: "Heading 3",
    description: "Small minor section heading",
    category: "Basic blocks",
    icon: Heading3,
    badge: "###",
    aliases: ["h3", "section", "header 3"],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleHeading({ level: 3 }).run();
    },
  },

  // ── Technical & Documentation
  {
    title: "Code block",
    description: "Syntax-highlighted terminal block",
    category: "Technical & Documentation",
    icon: Terminal,
    badge: "```",
    aliases: ["code", "terminal", "pre", "javascript", "typescript", "python"],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
    },
  },
  {
    title: "Callout box",
    description: "Tinted note, tip, or warning box",
    category: "Technical & Documentation",
    icon: Lightbulb,
    badge: "note",
    aliases: ["callout", "note", "tip", "warning", "info", "alert"],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleCallout({ type: "note" }).run();
    },
  },
  {
    title: "Blockquote",
    description: "Quoted passage or callout text",
    category: "Technical & Documentation",
    icon: TextQuote,
    badge: ">",
    aliases: ["quote", "blockquote", "cite"],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run();
    },
  },

  // ── Lists & Structure
  {
    title: "Task list",
    description: "Checklist with interactive checkable items",
    category: "Lists & Structure",
    icon: CheckSquare,
    badge: "[]",
    aliases: ["todo", "task", "check", "checklist"],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run();
    },
  },
  {
    title: "Bullet list",
    description: "Simple bulleted list",
    category: "Lists & Structure",
    icon: List,
    badge: "-",
    aliases: ["bullet", "unordered", "ul", "list"],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    title: "Numbered list",
    description: "Sequential numbered ordered list",
    category: "Lists & Structure",
    icon: ListOrdered,
    badge: "1.",
    aliases: ["number", "ordered", "ol", "steps"],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    title: "Divider",
    description: "Horizontal visual dividing rule",
    category: "Lists & Structure",
    icon: Minus,
    badge: "---",
    aliases: ["divider", "hr", "separator", "line"],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run();
    },
  },
  {
    title: "Table",
    description: "Interactive data table with rows & columns",
    category: "Lists & Structure",
    icon: TableIcon,
    badge: "grid",
    aliases: ["table", "grid", "spreadsheet", "cols", "rows"],
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run();
    },
  },
];

export const SlashCommand = Extension.create({
  name: "slashCommand",

  addOptions() {
    return {
      suggestion: {
        char: "/",
        startOfLine: false,
        command: ({ editor, range, props }: { editor: Editor; range: Range; props: SlashCommandItem }) => {
          props.command({ editor, range });
        },
        items: ({ query }: { query: string }): SlashCommandItem[] => {
          const q = query.toLowerCase().trim();
          if (!q) return SLASH_COMMANDS;
          return SLASH_COMMANDS.filter((item) => {
            if (item.title.toLowerCase().includes(q)) return true;
            if (item.description.toLowerCase().includes(q)) return true;
            return item.aliases.some((alias) => alias.toLowerCase().includes(q));
          });
        },
        render: () => {
          let component: ReactRenderer<SlashCommandRef> | null = null;
          let popupEl: HTMLDivElement | null = null;

          return {
            onStart: (props: SuggestionProps<SlashCommandItem>) => {
              component = new ReactRenderer(SlashCommandList, {
                props,
                editor: props.editor,
              });

              popupEl = document.createElement("div");
              popupEl.className = "slash-command-popup-container fixed z-50";
              document.body.appendChild(popupEl);
              popupEl.appendChild(component.element);

              const clientRect = props.clientRect;
              if (clientRect) {
                const rect = clientRect();
                if (rect) {
                  const top = Math.min(rect.bottom + 6, window.innerHeight - 340);
                  const left = Math.min(rect.left, window.innerWidth - 300);
                  popupEl.style.top = `${Math.max(12, top)}px`;
                  popupEl.style.left = `${Math.max(12, left)}px`;
                }
              }
            },

            onUpdate: (props: SuggestionProps<SlashCommandItem>) => {
              component?.updateProps(props);
              const clientRect = props.clientRect;
              if (clientRect && popupEl) {
                const rect = clientRect();
                if (rect) {
                  const top = Math.min(rect.bottom + 6, window.innerHeight - 340);
                  const left = Math.min(rect.left, window.innerWidth - 300);
                  popupEl.style.top = `${Math.max(12, top)}px`;
                  popupEl.style.left = `${Math.max(12, left)}px`;
                }
              }
            },

            onKeyDown: (props: SuggestionKeyDownProps) => {
              if (props.event.key === "Escape") {
                popupEl?.remove();
                component?.destroy();
                return true;
              }
              return component?.ref?.onKeyDown?.(props) ?? false;
            },

            onExit: () => {
              popupEl?.remove();
              component?.destroy();
              popupEl = null;
              component = null;
            },
          };
        },
      } as Partial<SuggestionOptions<SlashCommandItem>>,
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});
