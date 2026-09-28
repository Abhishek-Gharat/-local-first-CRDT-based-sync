"use client";

import { useCallback, useState } from "react";
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import {
  Info,
  Lightbulb,
  AlertTriangle,
  AlertOctagon,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import type { CalloutType } from "@/lib/editor/callout-extension";
import { cn } from "@/lib/utils";

interface CalloutConfig {
  label: string;
  icon: LucideIcon;
  wrapperClasses: string;
  badgeClasses: string;
  iconClasses: string;
}

const CALLOUT_CONFIGS: Record<CalloutType, CalloutConfig> = {
  note: {
    label: "Note",
    icon: Info,
    wrapperClasses:
      "border-l-blue-500 bg-blue-500/[0.07] border-blue-500/30 text-blue-950 dark:text-blue-100",
    badgeClasses:
      "bg-blue-500/15 text-blue-700 dark:text-blue-300 hover:bg-blue-500/25",
    iconClasses: "text-blue-600 dark:text-blue-400",
  },
  tip: {
    label: "Tip",
    icon: Lightbulb,
    wrapperClasses:
      "border-l-emerald-500 bg-emerald-500/[0.07] border-emerald-500/30 text-emerald-950 dark:text-emerald-100",
    badgeClasses:
      "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25",
    iconClasses: "text-emerald-600 dark:text-emerald-400",
  },
  warning: {
    label: "Warning",
    icon: AlertTriangle,
    wrapperClasses:
      "border-l-amber-500 bg-amber-500/[0.07] border-amber-500/30 text-amber-950 dark:text-amber-100",
    badgeClasses:
      "bg-amber-500/15 text-amber-700 dark:text-amber-300 hover:bg-amber-500/25",
    iconClasses: "text-amber-600 dark:text-amber-400",
  },
  danger: {
    label: "Danger",
    icon: AlertOctagon,
    wrapperClasses:
      "border-l-rose-500 bg-rose-500/[0.07] border-rose-500/30 text-rose-950 dark:text-rose-100",
    badgeClasses:
      "bg-rose-500/15 text-rose-700 dark:text-rose-300 hover:bg-rose-500/25",
    iconClasses: "text-rose-600 dark:text-rose-400",
  },
};

export function CalloutComponent({
  node,
  updateAttributes,
}: NodeViewProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const currentType = (node.attrs.type as CalloutType) || "note";
  const config = CALLOUT_CONFIGS[currentType] ?? CALLOUT_CONFIGS.note;
  const Icon = config.icon;

  const handleSelectType = useCallback(
    (type: CalloutType) => {
      updateAttributes({ type });
      setMenuOpen(false);
    },
    [updateAttributes],
  );

  return (
    <NodeViewWrapper
      className={cn(
        "callout-wrapper group/callout relative my-5 flex items-start gap-3.5 rounded-xl border border-l-4 p-4 text-sm transition-colors",
        config.wrapperClasses,
      )}
    >
      {/* Icon Badge & Type Selector Dropdown */}
      <div contentEditable={false} className="relative mt-0.5 shrink-0 select-none">
        <button
          type="button"
          aria-label={`Callout type: ${config.label}. Click to change.`}
          aria-haspopup="listbox"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((prev) => !prev)}
          className={cn(
            "flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold transition-all focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
            config.badgeClasses,
          )}
        >
          <Icon aria-hidden className={cn("size-3.5 shrink-0", config.iconClasses)} />
          <span className="text-[11px] font-medium tracking-wide uppercase">{config.label}</span>
          <ChevronDown aria-hidden className="size-2.5 opacity-60" />
        </button>

        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-30"
              onClick={() => setMenuOpen(false)}
            />
            <div
              role="listbox"
              aria-label="Change callout type"
              className="absolute top-full left-0 z-40 mt-1.5 flex min-w-36 flex-col gap-0.5 rounded-xl border border-border bg-popover p-1 shadow-lg backdrop-blur-md"
            >
              {(Object.keys(CALLOUT_CONFIGS) as CalloutType[]).map((type) => {
                const item = CALLOUT_CONFIGS[type];
                const ItemIcon = item.icon;
                const isSelected = type === currentType;
                return (
                  <button
                    key={type}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelectType(type)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none",
                      isSelected && "bg-accent font-semibold",
                    )}
                  >
                    <ItemIcon
                      aria-hidden
                      className={cn("size-3.5 shrink-0", item.iconClasses)}
                    />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Editable Callout Content Area */}
      <div className="min-w-0 flex-1">
        <NodeViewContent
          as="div"
          className="callout-content min-w-0 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0 [&>p]:my-1"
        />
      </div>
    </NodeViewWrapper>
  );
}
