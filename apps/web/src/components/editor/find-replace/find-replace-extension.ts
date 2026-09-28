import { Extension } from "@tiptap/core";
import type { Editor } from "@tiptap/react";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import {
  MATCH_LIMIT,
  clampIndex,
  findMatches,
  indexOfMatchAtOrAfter,
  wrapIndex,
  type MatchRange,
} from "@/components/editor/find-replace/search-core";

/**
 * Find and replace for the collaborative editor.
 *
 * Two decisions worth stating, because both are load-bearing for a CRDT:
 *
 * 1. **Matches are decorations, never document content.** A highlight mark
 *    would be part of the shared Yjs document — it would sync to every
 *    collaborator, land in exports, and appear in version history. A
 *    `DecorationSet` in plugin state is local to the browser that searched.
 *
 * 2. **Replacements are ordinary `insertText` steps.** Because they go through
 *    the normal transaction path, the Collaboration extension maps them into
 *    the shared document exactly like typing, so undo/redo stays per-user and
 *    remote cursors map correctly. There is no "replace" special case to keep
 *    in sync with the sync engine.
 */

export interface FindReplaceState {
  query: string;
  caseSensitive: boolean;
  matches: MatchRange[];
  /** 0-based index of the current match; meaningless when `matches` is empty. */
  index: number;
  /** True when the search hit `MATCH_LIMIT` and the count is a floor. */
  truncated: boolean;
}

const EMPTY: FindReplaceState = {
  query: "",
  caseSensitive: false,
  matches: [],
  index: 0,
  truncated: false,
};

export const findReplaceKey = new PluginKey<FindReplaceState>("findReplace");

type Meta =
  | { type: "setQuery"; query: string }
  | { type: "setCaseSensitive"; value: boolean }
  | { type: "select"; index: number }
  | { type: "close" };

/** Builds a fresh match set for a query, keeping the caret in view where it can. */
function derive(
  doc: Parameters<typeof findMatches>[0],
  previous: FindReplaceState,
  patch: Partial<Pick<FindReplaceState, "query" | "caseSensitive">>,
  from: number,
): FindReplaceState {
  const query = patch.query ?? previous.query;
  const caseSensitive = patch.caseSensitive ?? previous.caseSensitive;
  const matches = findMatches(doc, { query, caseSensitive });

  return {
    query,
    caseSensitive,
    matches,
    truncated: query.length > 0 && matches.length >= MATCH_LIMIT,
    // Land on the match nearest the caret, so opening the bar with the cursor
    // deep in the document does not start at match 1.
    index: clampIndex(indexOfMatchAtOrAfter(matches, from), matches.length),
  };
}

function meta(editor: Editor, payload: Meta): void {
  editor.view.dispatch(editor.state.tr.setMeta(findReplaceKey, payload));
}

export const FindReplace = Extension.create({
  name: "findReplace",

  addProseMirrorPlugins() {
    return [
      new Plugin<FindReplaceState>({
        key: findReplaceKey,

        state: {
          init: () => EMPTY,
          apply(tr, previous) {
            const payload = tr.getMeta(findReplaceKey) as Meta | undefined;
            if (payload) {
              switch (payload.type) {
                case "setQuery":
                  return derive(tr.doc, previous, { query: payload.query }, tr.selection.from);
                case "setCaseSensitive":
                  return derive(
                    tr.doc,
                    previous,
                    { caseSensitive: payload.value },
                    tr.selection.from,
                  );
                case "select":
                  return {
                    ...previous,
                    index: clampIndex(payload.index, previous.matches.length),
                  };
                case "close":
                  return EMPTY;
                default:
                  return previous;
              }
            }

            // Any document change — this user's typing, a remote peer's edit, or
            // our own replace — invalidates the match positions, because they are
            // raw document offsets. Recomputing here rather than in
            // `appendTransaction` keeps it to a single pass and removes any
            // chance of a second transaction feeding back into this one.
            if (tr.docChanged && previous.query.length > 0) {
              return derive(tr.doc, previous, {}, tr.selection.from);
            }

            return previous;
          },
        },

        props: {
          decorations(state) {
            const plugin = findReplaceKey.getState(state);
            if (!plugin || plugin.matches.length === 0) return DecorationSet.empty;

            const decorations = plugin.matches.map((match, i) =>
              Decoration.inline(match.from, match.to, {
                class:
                  i === plugin.index
                    ? "find-replace-match find-replace-match-active"
                    : "find-replace-match",
                // The active match carries the semantic meaning, so expose it to
                // assistive tech rather than relying on the highlight alone.
                "aria-label": i === plugin.index ? "Current match" : undefined,
              }),
            );

            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});

/* ── Public API, driven by the bar ─────────────────────────────────────── */

export function getFindState(editor: Editor): FindReplaceState {
  return findReplaceKey.getState(editor.state) ?? EMPTY;
}

export function setQuery(editor: Editor, query: string): void {
  meta(editor, { type: "setQuery", query });
}

export function setCaseSensitive(editor: Editor, value: boolean): void {
  meta(editor, { type: "setCaseSensitive", value });
}

export function closeFind(editor: Editor): void {
  meta(editor, { type: "close" });
}

/**
 * Moves to the next/previous match, selecting and scrolling to it.
 *
 * Selection is applied on the same transaction as the meta so the highlight and
 * the caret move together — setting the caret in a second dispatch would make
 * the "current match" decoration briefly point at the wrong range.
 */
export function stepMatch(editor: Editor, step: 1 | -1): void {
  const plugin = getFindState(editor);
  if (plugin.matches.length === 0) return;

  const index = wrapIndex(plugin.index, plugin.matches.length, step);
  const match = plugin.matches[index]!;
  const tr = editor.state.tr
    .setMeta(findReplaceKey, { type: "select", index })
    .setSelection(TextSelection.create(editor.state.doc, match.from, match.to));
  tr.scrollIntoView();
  editor.view.dispatch(tr);
}

/** Replaces the current match, then advances to the following one. */
export function replaceCurrentMatch(editor: Editor, replacement: string): void {
  const plugin = getFindState(editor);
  const match = plugin.matches[plugin.index];
  if (!match) return;

  const tr = editor.state.tr
    .insertText(replacement, match.from, match.to)
    .setMeta(findReplaceKey, { type: "setQuery", query: plugin.query });
  tr.scrollIntoView();
  editor.view.dispatch(tr);

  // The doc changed, so the match list is stale; re-read and step on.
  stepMatch(editor, 1);
}

/**
 * Replaces every match in one transaction.
 *
 * Applied back-to-front: inserting text shifts every later position, so
 * working from the end keeps the not-yet-touched ranges valid. One transaction
 * means one undo step for the user and one batched update for the CRDT.
 */
export function replaceAllMatches(editor: Editor, replacement: string): number {
  const plugin = getFindState(editor);
  if (plugin.matches.length === 0) return 0;

  const tr = editor.state.tr;
  for (let i = plugin.matches.length - 1; i >= 0; i--) {
    const match = plugin.matches[i]!;
    tr.insertText(replacement, match.from, match.to);
  }
  tr.setMeta(findReplaceKey, { type: "setQuery", query: plugin.query });
  editor.view.dispatch(tr);

  return plugin.matches.length;
}
