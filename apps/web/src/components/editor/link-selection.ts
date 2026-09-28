import type { Editor } from "@tiptap/react";

/**
 * Selection helpers for the link popover.
 *
 * Split out of the component because the interesting part is ProseMirror
 * position arithmetic, and position arithmetic is exactly the sort of thing
 * that needs its own tests rather than being exercised through a popover.
 */

/** The rectangle the popover should hang off when opened from the keyboard. */
export interface SelectionRect {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
  x: number;
  y: number;
}

/** The href of the link mark under the selection, or `undefined`. */
export function currentLinkHref(editor: Editor): string | undefined {
  const href = editor.getAttributes("link")?.href;
  return typeof href === "string" && href ? href : undefined;
}

/**
 * Widens a collapsed caret to the word it sits in.
 *
 * Without this, `⌘K` on a bare caret would have nothing to attach a mark to and
 * the popover would be a no-op — the most common way people reach for it. The
 * word is read out of the parent textblock, so the returned positions are
 * absolute document positions.
 *
 * Returns `false` when the caret is not inside a textblock, or is surrounded
 * only by whitespace, in which case there is nothing sensible to select.
 */
export function expandCaretToWord(editor: Editor): boolean {
  const { state } = editor;
  const { empty, from } = state.selection;
  if (!empty) return true;

  const $from = state.doc.resolve(from);
  if (!$from.parent.isTextblock) return false;

  // A single space stands in for leaf nodes (images, hard breaks) so that
  // offsets stay aligned with real positions.
  const leaf = "￼";
  const parentSize = $from.parent.content.size;
  const before = $from.parent.textBetween(0, $from.parentOffset, leaf, leaf);
  const after = $from.parent.textBetween($from.parentOffset, parentSize, leaf, leaf);

  // The word is whichever side the caret is actually touching: at the start of
  // a word that is the word to the right, at the end it is the word to the
  // left. A caret stranded in a run of spaces touches neither, and there is
  // nothing worth linking.
  const leftWord = before.match(/[^\s]*$/)?.[0].length ?? 0;
  const rightWord = after.match(/^[^\s]*/)?.[0].length ?? 0;
  if (leftWord === 0 && rightWord === 0) return false;

  // `parentOffset` is the caret's offset within the textblock, so the far edge
  // is measured from the same origin as the near one.
  const contentStart = $from.start();
  const startPos = contentStart + (before.length - leftWord);
  const endPos = contentStart + $from.parentOffset + rightWord;
  if (endPos <= startPos) return false;

  // Belt and braces: never hand a whitespace-only range to the link mark.
  const picked = $from.parent.textBetween(
    startPos - contentStart,
    endPos - contentStart,
    leaf,
    leaf,
  );
  if (!picked.trim()) return false;

  return editor.chain().focus().setTextSelection({ from: startPos, to: endPos }).run();
}

/**
 * Prepares the selection for link editing.
 *
 * Three cases, in priority order:
 *   1. already a range — leave it alone, the user chose it;
 *   2. caret inside a link — grow to the *whole* link, so replacing the href
 *      rewrites the link rather than the word under the cursor;
 *   3. bare caret — grow to the surrounding word.
 */
export function prepareLinkSelection(editor: Editor): void {
  if (!editor.state.selection.empty) return;
  if (editor.isActive("link")) {
    editor.chain().focus().extendMarkRange("link").run();
    return;
  }
  expandCaretToWord(editor);
}

/** Viewport rectangle covering the current selection, for popover anchoring. */
export function selectionRect(editor: Editor): SelectionRect | null {
  const view = editor.view;
  const { from, to } = editor.state.selection;
  // `coordsAtPos` reports only the four edges, not a full DOMRect.
  type Edges = Pick<DOMRect, "top" | "right" | "bottom" | "left">;
  let start: Edges;
  let end: Edges;
  try {
    start = view.coordsAtPos(from);
    end = view.coordsAtPos(to);
  } catch {
    return null;
  }

  const top = Math.min(start.top, end.top);
  const bottom = Math.max(start.bottom, end.bottom);
  const left = Math.min(start.left, end.left);
  const right = Math.max(start.right, end.right);

  return {
    top,
    left,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
    x: left,
    y: top,
  };
}
