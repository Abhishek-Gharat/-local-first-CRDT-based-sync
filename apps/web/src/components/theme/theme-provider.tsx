"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ThemeProviderProps } from "next-themes";

/**
 * Theme provider.
 *
 * `attribute="class"` is what makes the design system's `.dark` token block
 * work — every colour, border and shadow in `globals.css` is defined twice
 * and selected by that one class, so switching themes never means touching a
 * component.
 *
 * `enableColorScheme` is not optional here: it sets `color-scheme` so native
 * widgets (the share panel's role `<select>`, scrollbars, form controls) and
 * the browser's own canvas background switch with the tokens. Without it the
 * page reads as light-themed chrome wrapped around dark content.
 *
 * Transitions are deliberately *not* disabled — see `applyTheme` for how the
 * cross-fade is applied only for the duration of a change.
 */
// React 19 flags next-themes' anti-flicker inline script tag with a benign development warning:
// "Encountered a script tag while rendering React component..."
// Since next-themes needs this script to prevent light/dark flash before hydration, filter this false-positive.
if (process.env.NODE_ENV === "development") {
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    const isScriptTagWarning = args.some(
      (arg) =>
        typeof arg === "string" &&
        arg.includes("Encountered a script tag while rendering React component"),
    );
    if (isScriptTagWarning) return;
    originalError.apply(console, args);
  };
}

export function ThemeProvider({
  children,
  ...props
}: Partial<ThemeProviderProps> & { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      enableColorScheme
      disableTransitionOnChange={false}
      storageKey="docsync-theme"
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
