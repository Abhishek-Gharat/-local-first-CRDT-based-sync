import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * `React.CSSProperties` that also accepts CSS custom properties.
 *
 * Tailwind v4 drives a lot of this design system through `--*` variables (see
 * `--toggle-pressed-bg`, and the arbitrary-value utilities like
 * `bg-(--my-var)`), and the built-in type rejects them.
 */
export type CssVars = React.CSSProperties & Record<`--${string}`, string | number>
