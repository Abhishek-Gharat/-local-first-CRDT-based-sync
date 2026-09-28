"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { SlashCommandItem } from "@/lib/editor/slash-command-extension";
import { cn } from "@/lib/utils";

export interface SlashCommandRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

interface SlashCommandListProps {
  items: SlashCommandItem[];
  command: (item: SlashCommandItem) => void;
}

export const SlashCommandList = forwardRef<SlashCommandRef, SlashCommandListProps>(
  function SlashCommandList({ items, command }, ref) {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

    // Reset selection when search query changes filtered items
    useEffect(() => {
      setSelectedIndex(0);
    }, [items]);

    const selectItem = useCallback(
      (index: number) => {
        const item = items[index];
        if (item) {
          command(item);
        }
      },
      [items, command],
    );

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (event.key === "ArrowUp") {
          event.preventDefault();
          setSelectedIndex((prev) => (prev + items.length - 1) % Math.max(1, items.length));
          return true;
        }

        if (event.key === "ArrowDown") {
          event.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % Math.max(1, items.length));
          return true;
        }

        if (event.key === "Enter") {
          event.preventDefault();
          selectItem(selectedIndex);
          return true;
        }

        return false;
      },
    }));

    // Scroll active item into view
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;
      const activeEl = container.querySelector(`[data-index="${selectedIndex}"]`) as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }, [selectedIndex]);

    if (items.length === 0) {
      return (
        <div
          role="menu"
          aria-label="Slash commands"
          className="w-72 rounded-xl border border-border bg-popover/95 p-4 text-center text-xs text-muted-foreground shadow-2xl backdrop-blur-md"
        >
          No matching blocks or commands
        </div>
      );
    }

    // Group items by category
    const categories: Record<string, { item: SlashCommandItem; index: number }[]> = {};
    items.forEach((item, index) => {
      if (!categories[item.category]) {
        categories[item.category] = [];
      }
      categories[item.category]!.push({ item, index });
    });

    return (
      <div
        ref={containerRef}
        role="menu"
        aria-label="Slash commands"
        className="w-76 max-h-84 overflow-y-auto rounded-xl border border-border bg-popover/95 p-1.5 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-100"
      >
        <div className="px-2 pt-1 pb-1.5 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
          Insert Block or Command
        </div>

        {Object.entries(categories).map(([category, entries]) => (
          <div key={category} className="mb-1">
            <div className="px-2 py-1 text-[10px] font-medium text-muted-foreground/80">
              {category}
            </div>
            {entries.map(({ item, index }) => {
              const isSelected = index === selectedIndex;
              const Icon = item.icon;
              return (
                <button
                  key={item.title}
                  type="button"
                  role="menuitem"
                  data-index={index}
                  onClick={() => selectItem(index)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-2.5 py-1.5 text-left transition-colors",
                    isSelected
                      ? "bg-accent text-accent-foreground shadow-xs"
                      : "text-foreground hover:bg-accent/60",
                  )}
                >
                  <div
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-md border transition-colors",
                      isSelected
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border/80 bg-background/80 text-muted-foreground",
                    )}
                  >
                    <Icon aria-hidden className="size-3.5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-medium">{item.title}</span>
                      {item.badge && (
                        <kbd className="rounded border border-border/70 bg-muted/60 px-1 font-mono text-[9px] text-muted-foreground">
                          {item.badge}
                        </kbd>
                      )}
                    </div>
                    <p className="truncate text-[10px] text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    );
  },
);
