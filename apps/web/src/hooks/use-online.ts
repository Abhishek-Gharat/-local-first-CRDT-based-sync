"use client";

import { useSyncExternalStore } from "react";

/**
 * Reactive `navigator.onLine`.
 *
 * Uses `useSyncExternalStore` so the value is read during render rather than
 * copied into state from an effect — the online flag is an external system
 * this component subscribes to, and reading it lazily keeps the first render
 * correct instead of flashing a wrong value.
 */
export function useOnline(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener("online", onChange);
      window.addEventListener("offline", onChange);
      return () => {
        window.removeEventListener("online", onChange);
        window.removeEventListener("offline", onChange);
      };
    },
    () => window.navigator.onLine,
    // Server snapshot: assume online so SSR markup is not permanently
    // pessimistic; the client corrects on hydration.
    () => true,
  );
}
