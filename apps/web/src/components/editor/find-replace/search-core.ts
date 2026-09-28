import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

/**
 * Match-finding for the find-and-replace bar.
 *
 * Pure functions over a ProseMirror document — no plugin, no editor, no DOM —
 * so the search behaviour is testable directly and can be reasoned about
 * without a live editor.
 *
 * Deliberately searches per *textblock* rather than over one concatenated
 * document string. Searching per block means a term still matches when it
 * straddles a bold/italic boundary, because the block's text is read as one
 * run; the trade-off is that a query spanning a paragraph break will not match,
 * which no user types.
 */

/** A half-open `[from, to)` document range, as ProseMirror positions. */
export interface MatchRange {
  from: number;
  to: number;
}

/**
 * Stands in for inline leaf nodes (images, hard breaks) so that string offsets
 * stay aligned with document positions. One character per leaf keeps the
 * arithmetic in `findMatches` honest.
 */
const LEAF_PLACEHOLDER = "￼";

export interface FindOptions {
  query: string;
  /** `Aa`. Off by default, which is what people expect from a find bar. */
  caseSensitive?: boolean;
  /** Cap on returned matches, so a one-letter query cannot lock up the editor. */
  limit?: number;
}

/** Default ceiling on matches. Beyond this, the count is reported as "many". */
export const MATCH_LIMIT = 10_000;

/**
 * Finds every non-overlapping occurrence of `query`, in document order.
 *
 * Scanning restarts after each hit, so overlapping occurrences ("aaa" in
 * "aaaa") do not produce duplicate ranges covering the same characters.
 */
export function findMatches(
  doc: ProseMirrorNode,
  { query, caseSensitive = false, limit = MATCH_LIMIT }: FindOptions,
): MatchRange[] {
  const trimmed = query;
  if (!trimmed) return [];

  const needle = caseSensitive ? trimmed : trimmed.toLowerCase();
  const matches: MatchRange[] = [];
  let truncated = false;

  doc.descendants((node, pos) => {
    if (truncated) return false;
    if (!node.isTextblock) return true;

    const text = node.textBetween(0, node.content.size, LEAF_PLACEHOLDER, LEAF_PLACEHOLDER);
    const haystack = caseSensitive ? text : text.toLowerCase();

    // A textblock's content starts one position after the node itself.
    const contentStart = pos + 1;
    let cursor = 0;

    for (;;) {
      const at = haystack.indexOf(needle, cursor);
      if (at === -1) break;

      if (matches.length >= limit) {
        truncated = true;
        return false;
      }

      matches.push({
        from: contentStart + at,
        to: contentStart + at + needle.length,
      });
      cursor = at + needle.length;
    }

    // Handled the whole block; do not descend into its inline children.
    return false;
  });

  return matches;
}

/**
 * Whether the search hit its ceiling.
 *
 * The bar says "Many matches" rather than quoting a number that stopped being
 * true, so the indicator can never claim "12 of 12" when there are more.
 */
export function isTruncated(
  doc: ProseMirrorNode,
  { query, caseSensitive = false, limit = MATCH_LIMIT }: FindOptions,
): boolean {
  return (
    query.length > 0 &&
    findMatches(doc, { query, caseSensitive, limit }).length >= limit
  );
}

/** Keeps `index` inside `[0, count - 1]`, or 0 when there is nothing to point at. */
export function clampIndex(index: number, count: number): number {
  if (count <= 0) return 0;
  return Math.min(Math.max(index, 0), count - 1);
}

/**
 * Wraps `index` into range, which is what "next" and "previous" need.
 *
 * Search wraps rather than stopping at the ends, matching the behaviour of
 * every other find bar: hunting for the last of 40 matches should not require
 * 39 more presses of the down arrow to get back to the first.
 */
export function wrapIndex(index: number, count: number, step: 1 | -1): number {
  if (count <= 0) return 0;
  const next = index + step;
  if (next < 0) return count - 1;
  if (next >= count) return 0;
  return next;
}

/**
 * The index of the match at or after `from`, so that a match straddling the
 * caret can become the current one instead of being skipped.
 */
export function indexOfMatchAtOrAfter(matches: MatchRange[], from: number): number {
  if (matches.length === 0) return 0;
  const exact = matches.findIndex((m) => m.from <= from && from <= m.to);
  if (exact !== -1) return exact;
  const after = matches.findIndex((m) => m.from > from);
  return after === -1 ? 0 : after;
}
