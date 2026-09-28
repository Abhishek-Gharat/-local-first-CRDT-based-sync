"use client"

import * as React from "react"
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group"
import { Toggle as TogglePrimitive } from "@base-ui/react/toggle"

import { cn, type CssVars } from "@/lib/utils"

/**
 * Segmented control. Used wherever the product offers 2–3 mutually exclusive
 * modes (list vs grid, editor vs viewer, invite as editor vs viewer) so those
 * choices always present with the same affordance.
 */
function ToggleGroup({
  className,
  style,
  ...props
}: ToggleGroupPrimitive.Props<string>) {
  // The pressed appearance is driven by two custom properties declared on the
  // *group*, so a caller can retheme the whole segmented control by
  // overriding them on the same element. Declaring the defaults here rather
  // than on each item also means an item's own inline style can never shadow
  // the group's theming.
  const themeStyle: CssVars = {
    "--toggle-pressed-bg": "var(--background)",
    "--toggle-pressed-fg": "var(--foreground)",
  }

  return (
    <ToggleGroupPrimitive
      data-slot="toggle-group"
      style={style ? { ...themeStyle, ...style } : themeStyle}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg border border-border bg-muted/50 p-0.5",
        className
      )}
      {...props}
    />
  )
}

function ToggleItem({
  className,
  ...props
}: TogglePrimitive.Props<string>) {
  return (
    <TogglePrimitive
      data-slot="toggle-item"
      className={cn(
        "inline-flex h-6.5 items-center justify-center gap-1.5 rounded-[calc(var(--radius-sm)+1px)] px-2 text-xs font-medium whitespace-nowrap text-muted-foreground transition-all outline-none select-none",
        "hover:text-foreground",
        "focus-visible:ring-2 focus-visible:ring-ring/50",
        "data-pressed:bg-(--toggle-pressed-bg) data-pressed:text-(--toggle-pressed-fg) data-pressed:shadow-xs",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
        className
      )}
      {...props}
    />
  )
}

export { ToggleGroup, ToggleItem }
