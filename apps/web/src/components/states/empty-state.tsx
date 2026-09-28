import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EmptyStateAction {
  label: string;
  icon?: LucideIcon;
  onClick?: () => void;
  href?: string;
}

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: React.ReactNode;
  /** Short supporting list — turns a dead end into a set of next steps. */
  steps?: { label: string; hint: string }[];
  actions?: EmptyStateAction[];
  className?: string;
  /** `panel` sits inside a bordered surface; `page` fills the viewport. */
  variant?: "panel" | "page";
}

/**
 * Deliberate empty state. Every empty view in the product routes through this
 * so a blank screen is always an explanation plus at least one way forward,
 * never a lone icon and a sentence.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  steps,
  actions,
  className,
  variant = "panel",
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        variant === "panel"
          ? "rounded-xl border border-dashed border-border bg-muted/20 px-6 py-12"
          : "px-6 py-16",
        className,
      )}
    >
      {/* Layered badge: ring + soft primary tint, so it reads as branded
          rather than as a generic grey circle. */}
      <span className="relative mb-5 flex size-12 items-center justify-center">
        <span
          aria-hidden
          className="absolute inset-0 rounded-2xl bg-primary/8 ring-1 ring-primary/15"
        />
        <Icon aria-hidden className="relative size-5 text-primary" />
      </span>

      <h2 className="text-sm font-semibold tracking-tight text-foreground">
        {title}
      </h2>
      <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-balance text-muted-foreground">
        {description}
      </p>

      {steps && steps.length > 0 && (
        <ol className="mt-6 w-full max-w-sm space-y-2 text-left">
          {steps.map((step, i) => (
            <li
              key={step.label}
              className="flex items-start gap-2.5 rounded-lg border border-border bg-card px-3 py-2"
            >
              <span
                aria-hidden
                className="mt-px inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary tabular-nums"
              >
                {i + 1}
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-medium text-foreground">
                  {step.label}
                </span>
                <span className="block text-[11px] leading-snug text-muted-foreground">
                  {step.hint}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}

      {actions && actions.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {actions.map((action) => {
            const ActionIcon = action.icon;
            return (
              <button
                key={action.label}
                type="button"
                onClick={action.onClick}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-xs font-medium text-foreground shadow-xs transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                {ActionIcon ? <ActionIcon aria-hidden className="size-3.5" /> : null}
                {action.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
