"use client";

import { useEffect, useState } from "react";

/**
 * Subscribes to a CSS media query. Used where a layout decision genuinely
 * changes the *markup* (rather than just the styling) — e.g. the editor
 * toolbar collapsing its structure group into an overflow menu — so the
 * collapsed and expanded variants never both exist in the accessibility tree.
 *
 * Starts `false` on the server and during the first client render so the
 * markup matches on hydration, then corrects on mount.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const list = window.matchMedia(query);
    const update = () => setMatches(list.matches);
    update();
    list.addEventListener("change", update);
    return () => list.removeEventListener("change", update);
  }, [query]);

  return matches;
}
