import { useMemo } from "react";
import { useEditorState } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

/**
 * Document outline: the heading tree of a ProseMirror document.
 *
 * Strictly read-only. Nothing in this module dispatches a transaction, moves
 * the selection, or touches the Y.Doc — in a collaborative document the
 * selection *is* shared state, so even "just select the heading" would be a
 * visible edit to every other collaborator. Navigation here is scroll-only.
 */

export interface OutlineItem {
  /** Stable within one document version; derived from position, not persisted. */
  key: string;
  /** Heading level, 1–3. */
  level: number;
  /** Visible text of the heading. */
  text: string;
  /** Document position of the heading node, as ProseMirror offsets. */
  pos: number;
}

/** Deepest heading level the outline renders. */
export const MAX_OUTLINE_LEVEL = 3;

/**
 * Collects every heading in document order.
 *
 * Levels deeper than `MAX_OUTLINE_LEVEL` are dropped: a fourth-level heading
 * would indent too far to read, and the editor's block menu only offers H1–H3.
 */
export function extractOutline(
  doc: ProseMirrorNode,
  maxLevel = MAX_OUTLINE_LEVEL,
): OutlineItem[] {
  const items: OutlineItem[] = [];

  doc.descendants((node, pos) => {
    if (node.type.name !== "heading") return true;

    const level = node.attrs.level as number;
    if (level > maxLevel) return false;

    const text = node.textContent.trim();
    // A heading still being typed is legitimately empty for a moment; keeping it
    // would show a blank row that flickers in and out as the user types.
    if (!text) return false;

    items.push({ key: `${pos}:${level}:${text}`, level, text, pos });
    return false;
  });

  return items;
}

/**
 * Live outline for an editor.
 *
 * Built on `useEditorState` so the selector re-runs on every transaction,
 * including ones caused by remote collaborators — which is what makes the
 * outline update live rather than only on load.
 */
export function useDocumentOutline(
  editor: Editor | null,
  maxLevel = MAX_OUTLINE_LEVEL,
): OutlineItem[] {
  const selector = useMemo(
    () => ({ editor: e }: { editor: Editor | null }) =>
      e && !e.isDestroyed && e.state?.doc ? extractOutline(e.state.doc, maxLevel) : [],
    [maxLevel],
  );

  return (
    useEditorState({ editor, selector }) ?? []
  );
}

/**
 * Index of the heading the reader is currently at.
 *
 * Takes the viewport-relative top of each heading, because that is the only
 * thing the scroll position actually tells us. The active heading is the last
 * one at or above the reading line — the section you are looking at is the one
 * whose title you have already scrolled past.
 *
 * `readingLine` is the offset from the top of the viewport (not the document),
 * so it should account for the sticky app bar: a heading hidden behind the bar
 * is not one you are reading.
 */
export function findActiveIndex(
  headingTops: readonly number[],
  readingLine: number,
): number {
  if (headingTops.length === 0) return -1;

  let active = -1;
  for (let i = 0; i < headingTops.length; i++) {
    if (headingTops[i]! <= readingLine) {
      active = i;
    } else {
      break;
    }
  }

  // Above the first heading (the document's opening section), treat the first
  // heading as current rather than showing nothing highlighted.
  if (active === -1) return 0;
  return active;
}

/**
 * The DOM element for a heading, or `null` if it is not currently rendered.
 *
 * Tries `nodeDOM` first because it returns the heading element itself, and
 * falls back to `domAtPos` + a tag search for the cases `nodeDOM` declines —
 * for instance when the heading is inside a list item.
 */
export function headingElement(
  editor: Editor,
  pos: number,
): HTMLElement | null {
  if (editor.isDestroyed) return null;
  const view = editor.view;

  const direct = view.nodeDOM(pos);
  if (direct instanceof HTMLElement && /^H[1-6]$/.test(direct.tagName)) {
    return direct;
  }

  try {
    const { node } = view.domAtPos(pos);
    const element = node instanceof HTMLElement ? node : node.parentElement;
    return element?.closest("h1, h2, h3, h4, h5, h6") ?? null;
  } catch {
    return null;
  }
}

/**
 * Scrolls a heading into view.
 *
 * Scroll-only by design: setting the selection would be a shared-state edit in
 * a collaborative document. `block: "start"` puts the heading just below the
 * sticky app bar rather than flush against the viewport edge, where the bar
 * would cover it.
 */
export function scrollToHeading(editor: Editor, pos: number): boolean {
  const element = headingElement(editor, pos);
  if (!element) return false;

  // Guarded because `scrollIntoView` is not universal — it is absent in jsdom
  // and in older browsers, and throwing here would leave the popover stuck open
  // with no navigation performed.
  if (typeof element.scrollIntoView === "function") {
    element.scrollIntoView({ behavior: "smooth", block: "start" });
    return true;
  }

  // Fallback: move the scrolling ancestor so the heading's top edge lands at the
  // top of the viewport.
  const top = element.getBoundingClientRect().top + window.scrollY;
  window.scrollTo({ top, behavior: "smooth" });
  return true;
}
