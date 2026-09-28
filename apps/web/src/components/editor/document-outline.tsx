"use client";

import { useCallback, useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";
import { ListTree } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { TooltipButton } from "@/components/ui/tooltip-button";
import {
  findActiveIndex,
  headingElement,
  scrollToHeading,
  useDocumentOutline,
  type OutlineItem,
} from "@/lib/editor/outline";
import { findShortcut, formatShortcut } from "@/lib/keyboard/shortcuts";
import { useIsMac } from "@/lib/keyboard/use-is-mac";
import { cn } from "@/lib/utils";

interface DocumentOutlineProps {
  editor: Editor | null;
}

/**
 * How far below the top of the viewport a heading still counts as "the one you
 * are reading". Matches the app bar's height so a title tucked behind it is
 * treated as already scrolled past.
 */
const READING_LINE = 140;

/** Indentation step per heading level, in rem. */
const INDENT = 0.75;

/**
 * Live document outline.
 *
 * A popover rather than a permanent sidebar: the canvas is already a single
 * centred column, and a third column beside it would cost more space than the
 * navigation is worth on a screen where nobody is lost.
 */
export function DocumentOutline({ editor }: DocumentOutlineProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const items = useDocumentOutline(editor);
  const isMac = useIsMac();

  // Track which section is on screen. Listening on the capture phase catches
  // scrolling in any ancestor, since the page and not the canvas is what
  // actually scrolls.
  useEffect(() => {
    if (!editor) return;

    const measure = () => {
      const tops = items
        .map((item) => headingElement(editor, item.pos))
        .map((element) => (element ? element.getBoundingClientRect().top : null));

      // A heading that is not rendered yet cannot inform the answer, so leave
      // the previous highlight rather than guessing.
      if (tops.some((top) => top === null)) return;
      setActiveIndex(findActiveIndex(tops as number[], READING_LINE));
    };

    measure();
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [editor, items]);

  const select = useCallback(
    (item: OutlineItem) => {
      if (!editor) return;
      scrollToHeading(editor, item.pos);
      setActiveIndex(items.indexOf(item));
      setOpen(false);
      // Focus is deliberately *not* returned to the canvas here. Tiptap's
      // `focus()` can normalise the document — with a heading as the last
      // block it appends a trailing empty paragraph — which would be a
      // collaborative edit caused by reading the outline. Base UI restores
      // focus to the trigger, which is both safe and predictable.
    },
    [editor, items],
  );

  const headingShortcut = formatShortcut(
    findShortcut("h1")?.keys ?? null,
    isMac,
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <TooltipButton
            label="Document outline"
            tooltipSide="bottom"
            className="size-8 text-muted-foreground"
            // A popover toggles on click, so only the mousedown is prevented —
            // that is the event which would otherwise blur the canvas.
            onMouseDown={(event) => event.preventDefault()}
          >
            <ListTree aria-hidden className="size-4" />
          </TooltipButton>
        }
      />

      <PopoverContent
        // A popover is a dialog and needs an accessible name of its own; the
        // <nav> inside is a second, distinct landmark for the list itself.
        aria-label="Document outline"
        align="end"
        side="bottom"
        className="max-h-[min(24rem,60dvh)] w-72 overflow-y-auto p-1"
      >
        <nav aria-label="Document outline">
          {items.length === 0 ? (
            <p className="px-2 py-3 text-xs text-muted-foreground">
              No headings yet. Add a heading (
              {headingShortcut.map((key, index) => (
                <span key={key} className="whitespace-nowrap">
                  {index > 0 && <span aria-hidden> </span>}
                  <kbd className="rounded border border-border bg-muted px-1 py-px text-[10px] font-medium">
                    {key}
                  </kbd>
                </span>
              ))}
              …) to generate an outline.
            </p>
          ) : (
            <ul className="flex flex-col">
              {items.map((item, index) => {
                const isActive = index === activeIndex;
                return (
                  <li key={item.key}>
                    <button
                      type="button"
                      // Flattened into a plain button: the indentation conveys
                      // nesting visually, and the level is announced in the
                      // accessible name so it is available without sight of it.
                      aria-current={isActive ? "true" : undefined}
                      onClick={() => select(item)}
                      style={{ paddingLeft: `${0.5 + (item.level - 1) * INDENT}rem` }}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md py-1.5 pr-2 text-left text-xs transition-colors",
                        "hover:bg-accent hover:text-accent-foreground",
                        "focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
                        isActive
                          ? "bg-primary/10 font-medium text-primary"
                          : "text-foreground",
                      )}
                    >
                      <span className="min-w-0 flex-1 truncate">{item.text}</span>
                      <span className="sr-only">
                        Heading level {item.level}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </nav>
      </PopoverContent>
    </Popover>
  );
}
