"use client";

import type { Editor } from "@tiptap/react";
import {
  BetweenVerticalEnd,
  BetweenHorizontalEnd,
  Trash2,
  Heading,
  Plus,
  Minus,
} from "lucide-react";
import { TooltipButton } from "@/components/ui/tooltip-button";

interface TableFloatingMenuProps {
  editor: Editor;
}

export function TableFloatingMenu({ editor }: TableFloatingMenuProps) {
  if (!editor.isActive("table")) {
    return null;
  }

  return (
    <div
      role="toolbar"
      aria-label="Table options"
      className="sticky top-24 z-20 mx-auto my-1 flex max-w-fit items-center gap-1 rounded-xl border border-border bg-card/95 p-1 shadow-lg backdrop-blur-md animate-in fade-in zoom-in-95 duration-100"
    >
      <span className="px-2 text-[10px] font-semibold text-muted-foreground uppercase">
        Table
      </span>

      <span className="h-3.5 w-px bg-border" aria-hidden />

      {/* Row operations */}
      <TooltipButton
        label="Insert row above"
        onClick={() => editor.chain().focus().addRowBefore().run()}
        className="size-7"
      >
        <span className="flex items-center text-[10px]">
          <BetweenHorizontalEnd aria-hidden className="size-3.5" />
          <Plus aria-hidden className="-ml-1 size-2" />
        </span>
      </TooltipButton>

      <TooltipButton
        label="Insert row below"
        onClick={() => editor.chain().focus().addRowAfter().run()}
        className="size-7"
      >
        <BetweenHorizontalEnd aria-hidden className="size-3.5" />
      </TooltipButton>

      <TooltipButton
        label="Delete row"
        onClick={() => editor.chain().focus().deleteRow().run()}
        className="size-7 hover:text-destructive"
      >
        <span className="flex items-center text-[10px]">
          <BetweenHorizontalEnd aria-hidden className="size-3.5" />
          <Minus aria-hidden className="-ml-1 size-2" />
        </span>
      </TooltipButton>

      <span className="h-3.5 w-px bg-border" aria-hidden />

      {/* Column operations */}
      <TooltipButton
        label="Insert column left"
        onClick={() => editor.chain().focus().addColumnBefore().run()}
        className="size-7"
      >
        <span className="flex items-center text-[10px]">
          <BetweenVerticalEnd aria-hidden className="size-3.5" />
          <Plus aria-hidden className="-ml-1 size-2" />
        </span>
      </TooltipButton>

      <TooltipButton
        label="Insert column right"
        onClick={() => editor.chain().focus().addColumnAfter().run()}
        className="size-7"
      >
        <BetweenVerticalEnd aria-hidden className="size-3.5" />
      </TooltipButton>

      <TooltipButton
        label="Delete column"
        onClick={() => editor.chain().focus().deleteColumn().run()}
        className="size-7 hover:text-destructive"
      >
        <span className="flex items-center text-[10px]">
          <BetweenVerticalEnd aria-hidden className="size-3.5" />
          <Minus aria-hidden className="-ml-1 size-2" />
        </span>
      </TooltipButton>

      <span className="h-3.5 w-px bg-border" aria-hidden />

      {/* Header & Table delete */}
      <TooltipButton
        label="Toggle header row"
        onClick={() => editor.chain().focus().toggleHeaderRow().run()}
        className="size-7"
      >
        <Heading aria-hidden className="size-3.5" />
      </TooltipButton>

      <TooltipButton
        label="Delete entire table"
        onClick={() => editor.chain().focus().deleteTable().run()}
        className="size-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 aria-hidden className="size-3.5" />
      </TooltipButton>
    </div>
  );
}
