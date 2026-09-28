"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { ToggleGroup, ToggleItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenuGroup,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { applyTheme, resolveTheme } from "@/lib/theme/apply-theme";
import { cn, type CssVars } from "@/lib/utils";

/**
 * The active mode is a brand-coloured chip, so it reads as "this is what you
 * chose" rather than as one more grey segment in a row of grey segments.
 * Set once on the group; every `ToggleItem` inside inherits it.
 */
const ACTIVE_CHIP_VARS: CssVars = {
  "--toggle-pressed-bg": "color-mix(in oklch, var(--primary) 14%, transparent)",
  "--toggle-pressed-fg": "var(--primary)",
};

type Theme = "light" | "dark" | "system";

const OPTIONS: { value: Theme; label: string; icon: LucideIcon }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "system", label: "System", icon: Monitor },
  { value: "dark", label: "Dark", icon: Moon },
];

/** `true` only after hydration, without a state-in-effect cascade. */
const noopSubscribe = () => () => {};
function useHydrated() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

interface ThemeToggleProps {
  className?: string;
  /** Show the mode names next to the icons (account menu) or icons only (rail). */
  showLabels?: boolean;
}

/**
 * Three-state theme control: Light · System · Dark.
 *
 * Rendered as a segmented control rather than a single toggle button because
 * "System" is a real, distinct choice — a two-state switch cannot express it,
 * and users who never open the OS settings need a way to get back to it.
 *
 * Hydration: `next-themes` cannot know the resolved theme on the server, so
 * the control renders an inert placeholder of identical dimensions until the
 * client takes over. Same box either way, so nothing reflows — and the
 * server-rendered markup never claims a theme the user may not have chosen.
 */
export function ThemeToggle({ className, showLabels = false }: ThemeToggleProps) {
  const hydrated = useHydrated();
  const { theme, setTheme } = useTheme();

  const active: Theme = hydrated ? ((theme as Theme) ?? "system") : "system";

  // The System chip annotates itself with the palette it currently resolves
  // to — otherwise a dark-mode user staring at "System" has no way to tell
  // whether the OS preference is actually being honoured.
  const resolved = hydrated ? resolveTheme(active) : null;

  return (
    <div
      className={cn("flex items-center gap-2", className)}
      data-hydrated={hydrated}
    >
      <ToggleGroup
        value={[active]}
        onValueChange={(value) => {
          const next = value[0];
          if (!next) return;
          applyTheme(next as Theme, setTheme);
        }}
        aria-label="Colour theme"
        className={cn(showLabels ? "w-full" : "shrink-0")}
        style={ACTIVE_CHIP_VARS}
      >
        {OPTIONS.map((option) => (
          <Tooltip key={option.value}>
            <TooltipTrigger
              render={
                <ToggleItem
                  value={option.value}
                  aria-label={`${option.label} theme`}
                  className={cn(showLabels ? "flex-1 gap-1.5" : "size-6.5 px-0")}
                />
              }
            >
              <option.icon aria-hidden className="size-3.5" />
              {showLabels && <span>{option.label}</span>}
            </TooltipTrigger>
            <TooltipContent>
              {option.label}
              {option.value === "system" && resolved && (
                <span className="opacity-70"> · {resolved}</span>
              )}
            </TooltipContent>
          </Tooltip>
        ))}
      </ToggleGroup>
    </div>
  );
}

/**
 * Labelled variant for use inside a dropdown menu.
 *
 * Rendered as a real `Menu.Group` + `Menu.GroupLabel` rather than a bare
 * paragraph, so assistive tech announces "Appearance" as the name of the group
 * the three options belong to. Base UI also requires a GroupLabel to sit
 * inside a Group, so this is where the grouping has to live.
 */
export function ThemeControl({ className }: { className?: string }) {
  return (
    <DropdownMenuGroup className={className}>
      <DropdownMenuLabel>Appearance</DropdownMenuLabel>
      <div className="px-1.5 pt-0.5 pb-1">
        <ThemeToggle showLabels />
      </div>
    </DropdownMenuGroup>
  );
}
