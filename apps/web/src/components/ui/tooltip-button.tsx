"use client"

import type * as React from "react";
import { Button, type buttonVariants } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Kbd } from "@/components/ui/kbd";
import type { VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

interface TooltipButtonProps
  extends Omit<React.ComponentProps<typeof Button>, "aria-label">,
    VariantProps<typeof buttonVariants> {
  /** Visible tooltip copy. Doubles as the accessible name when `label` is omitted. */
  label: string;
  /** Rendered to the right of the label as a keyboard hint, e.g. `mod+B`. */
  shortcut?: string[];
  tooltipSide?: "top" | "bottom" | "left" | "right";
}

/**
 * Icon button + tooltip + keyboard hint, as one unit.
 *
 * Every icon-only control in the product is built from this so that (a) no
 * icon button can ship without an accessible name, (b) no tooltip can drift
 * from its trigger's label, and (c) toolbar/app-bar spacing, focus ring and
 * hover treatment are identical everywhere.
 */
export function TooltipButton({
  label,
  shortcut,
  tooltipSide = "top",
  variant = "ghost",
  size = "icon-sm",
  className,
  children,
  ...props
}: TooltipButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant={variant}
            size={size}
            aria-label={label}
            title={props.title ?? label}
            className={cn(className)}
            {...props}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side={tooltipSide}>
        <span>{label}</span>
        {shortcut && shortcut.length > 0 && (
          <>
            <span aria-hidden className="h-3 w-px bg-background/25" />
            {shortcut.map((key) => (
              <Kbd
                key={key}
                className="border-background/25 bg-background/15 text-background"
              >
                {key}
              </Kbd>
            ))}
          </>
        )}
      </TooltipContent>
    </Tooltip>
  )
}
