"use client";

/**
 * A one-slot bridge from the ProseMirror keymap to the React link popover.
 *
 * `⌘K` is bound in a Tiptap extension, but the popover that has to open is
 * React state living in the toolbar. Extensions are created once when the
 * editor mounts and have no access to component state, so the keymap emits a
 * request here and the mounted popover picks it up.
 *
 * Deliberately not an event emitter with payloads: there is exactly one
 * subscriber (the link popover) and exactly one request ("open me"). Keeping it
 * that narrow means there is no ordering or cleanup contract to get wrong, and
 * no listener can leak because the only subscription is an effect in a
 * component that unmounts with the editor.
 */

type Listener = () => void;

const listeners = new Set<Listener>();

/** Subscribes to open-requests. Returns the unsubscribe function. */
export function onLinkPopoverRequest(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Asks the link popover to open on the current selection.
 *
 * Safe to call with nothing mounted: a viewer has no toolbar, so there is no
 * popover to open, and the shortcut is simply inert.
 */
export function requestLinkPopover(): void {
  for (const listener of [...listeners]) listener();
}

/** Test-only: drops all subscriptions. */
export function resetLinkPopoverBridge(): void {
  listeners.clear();
}
