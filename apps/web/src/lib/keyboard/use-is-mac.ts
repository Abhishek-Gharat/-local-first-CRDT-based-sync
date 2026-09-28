"use client";

import { useSyncExternalStore } from "react";
import { detectMac } from "@/lib/keyboard/shortcuts";

// The platform never changes during a session, so the subscribe function only
// has to hand back an unsubscribe; the value is read on every render instead
// of being copied into state from an effect.
const noopSubscribe = () => () => {};

/**
 * True on Apple platforms, where shortcuts are printed with ⌘/⌥/⇧ and the
 * primary modifier is Meta rather than Control.
 *
 * The server has no `navigator`, so this reports `false` there and the client
 * corrects on hydration. Shortcut *labels* are the only thing that depends on
 * it, which makes a first-paint mismatch cosmetic rather than behavioural.
 */
export function useIsMac(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => detectMac(),
    () => false,
  );
}
