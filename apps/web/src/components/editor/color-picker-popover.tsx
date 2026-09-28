"use client";

import { useCallback } from "react";
import type { Editor } from "@tiptap/react";
import { Baseline, Highlighter, RotateCcw } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { TEXT_COLORS, HIGHLIGHT_COLORS } from "@/lib/editor/colors";
import { cn } from "@/lib/utils";

interface ColorPickerPopoverProps {
  editor: Editor;
  className?: string;
}

export function ColorPickerPopover({ editor, className }: ColorPickerPopoverProps) {
  const activeColor = (editor.getAttributes("textStyle")?.color as string) || "";
  const activeHighlight = (editor.getAttributes("highlight")?.color as string) || "";
  const hasActiveColor = Boolean(activeColor || activeHighlight);

  const handleSetTextColor = useCallback(
    (color: string) => {
      if (!color) {
        editor.chain().focus().unsetColor().run();
      } else {
        editor.chain().focus().setColor(color).run();
      }
    },
    [editor],
  );

  const handleSetHighlight = useCallback(
    (color: string) => {
      if (!color) {
        editor.chain().focus().unsetHighlight().run();
      } else {
        editor.chain().focus().setHighlight({ color }).run();
      }
    },
    [editor],
  );

  const handleResetAll = useCallback(() => {
    editor.chain().focus().unsetColor().unsetHighlight().run();
  }, [editor]);

  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label="Text & Highlight colors"
            className={cn(
              "flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
              hasActiveColor && "text-primary font-semibold",
              className,
            )}
          />
        }
      >
        <span className="relative flex items-center justify-center">
          <Baseline aria-hidden className="size-3.5" />
          {activeColor && (
            <span
              className="absolute -bottom-1 h-0.5 w-3 rounded-full"
              style={{ backgroundColor: activeColor }}
            />
          )}
        </span>
      </PopoverTrigger>

      <PopoverContent align="center" className="w-64 p-3 shadow-xl">
        <div className="space-y-3">
          {/* Text Color Section */}
          <div>
            <div className="flex items-center justify-between pb-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              <span className="flex items-center gap-1.5">
                <Baseline aria-hidden className="size-3 text-muted-foreground" />
                Text color
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {TEXT_COLORS.map((c) => {
                const isSelected = activeColor.toLowerCase() === c.value.toLowerCase();
                return (
                  <button
                    key={c.label}
                    type="button"
                    title={c.label}
                    aria-label={`Text color: ${c.label}`}
                    onClick={() => handleSetTextColor(c.value)}
                    className={cn(
                      "flex size-6 items-center justify-center rounded-full border transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
                      c.bgClass,
                      isSelected
                        ? "border-primary ring-2 ring-primary/40 ring-offset-1"
                        : "border-border/60",
                    )}
                  />
                );
              })}
            </div>
          </div>

          <div className="h-px bg-border/60" />

          {/* Highlight Color Section */}
          <div>
            <div className="flex items-center justify-between pb-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              <span className="flex items-center gap-1.5">
                <Highlighter aria-hidden className="size-3 text-muted-foreground" />
                Highlight
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {HIGHLIGHT_COLORS.map((c) => {
                const isSelected = activeHighlight.toLowerCase() === c.value.toLowerCase();
                return (
                  <button
                    key={c.label}
                    type="button"
                    title={c.label}
                    aria-label={`Highlight: ${c.label}`}
                    onClick={() => handleSetHighlight(c.value)}
                    className={cn(
                      "flex size-6 items-center justify-center rounded-full transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
                      c.bgClass,
                      isSelected && "ring-2 ring-primary/40 ring-offset-1",
                    )}
                  />
                );
              })}
            </div>
          </div>

          {hasActiveColor && (
            <>
              <div className="h-px bg-border/60" />
              <button
                type="button"
                onClick={handleResetAll}
                className="flex w-full items-center justify-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none"
              >
                <RotateCcw aria-hidden className="size-3" />
                <span>Reset colors</span>
              </button>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
