"use client";

/**
 * A one-slot bridge from the ProseMirror keymap to the React find bar.
 *
 * `⌘F` is bound in a Tiptap extension, but the bar it opens is React state in
 * the editor surface. Extensions are built once when the editor mounts and have
 * no access to component state, so the keymap emits a request here and the
 * mounted bar picks it up.
 *
 * Same shape, and the same reasoning, as `link-popover-bridge.ts`.
 */

type Listener = () => void;

const listeners = new Set<Listener>();

export function onFindReplaceRequest(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Asks the find bar to open.
 *
 * Safe with nothing mounted — a read-only viewer has no bar, so the shortcut is
 * simply inert.
 */
export function requestFindReplace(): void {
  for (const listener of [...listeners]) listener();
}

/** Test-only: drops all subscriptions. */
export function resetFindReplaceBridge(): void {
  listeners.clear();
}
