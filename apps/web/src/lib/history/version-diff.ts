import * as Y from "yjs";
import { getSchema } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { yXmlFragmentToProseMirrorRootNode } from "@tiptap/y-tiptap";
import { diffWordsWithSpace, type Change } from "diff";

/**
 * Visual diffs between a saved version and the live document.
 *
 * The interesting question here is not "how do we diff two strings" — the
 * `diff` package answers that — but "where do the two strings come from". A
 * version is a `Y.encodeStateAsUpdate` blob, not text, so it has to be decoded
 * into a document before it can be compared. That decoding is the part worth
 * isolating, because it is the part that can silently go wrong: a snapshot read
 * against the wrong schema, or a fragment read from the wrong Y.Doc, produces
 * a plausible-looking diff of the wrong content.
 *
 * Everything that touches Yjs is kept out of `computeTextDiff`, so the diff
 * logic itself is pure and testable without a CRDT.
 */

// Same schema and fragment name `restore.ts` uses. Kept in step with it on
// purpose: a diff computed against a different schema than the one restores
// with would compare the wrong thing.
const schema = getSchema([StarterKit.configure({ undoRedo: false })]);
const FRAGMENT_NAME = "default";

/** One run of unchanged, added or removed text. */
export interface DiffChunk {
  value: string;
  added?: boolean;
  removed?: boolean;
}

export interface DiffSummary {
  addedWords: number;
  removedWords: number;
}

/**
 * Reads the plain text of a saved snapshot.
 *
 * The snapshot is applied to a throwaway Y.Doc rather than the live one: the
 * live doc must not be touched by a read, and applying an old state update to
 * it would corrupt the shared document.
 */
export function decodeSnapshotToText(snapshot: Uint8Array): string {
  const scratch = new Y.Doc();
  try {
    Y.applyUpdate(scratch, snapshot);
    const node = yXmlFragmentToProseMirrorRootNode(
      scratch.getXmlFragment(FRAGMENT_NAME),
      schema,
    );
    return node.textContent;
  } finally {
    scratch.destroy();
  }
}

/** Reads the plain text of the live document. */
export function getLiveDocumentText(doc: Y.Doc): string {
  const node = yXmlFragmentToProseMirrorRootNode(
    doc.getXmlFragment(FRAGMENT_NAME),
    schema,
  );
  return node.textContent;
}

/**
 * Diffs two texts into renderable chunks.
 *
 * `diffWordsWithSpace` is used rather than `diffLines` because the point of the
 * view is to show *what changed*, and a line-level diff would repaint a whole
 * paragraph when one word in it moved. Word-level keeps unchanged prose
 * collapsed and readable.
 *
 * The `oldText` argument is the snapshot and `newText` the live document, so
 * `added` means "present now, absent then" — which is what the green highlight
 * is for.
 */
export function computeTextDiff(oldText: string, newText: string): DiffChunk[] {
  const changes: Change[] = diffWordsWithSpace(oldText, newText);

  return changes.map((change) => {
    const chunk: DiffChunk = { value: change.value };
    if (change.added) chunk.added = true;
    if (change.removed) chunk.removed = true;
    return chunk;
  });
}

/** Counts the words added and removed across a set of chunks. */
export function summarizeDiff(chunks: readonly DiffChunk[]): DiffSummary {
  let addedWords = 0;
  let removedWords = 0;

  for (const chunk of chunks) {
    const words = chunk.value.trim().split(/\s+/).filter(Boolean).length;
    if (chunk.added) addedWords += words;
    if (chunk.removed) removedWords += words;
  }

  return { addedWords, removedWords };
}

/**
 * The whole comparison in one call, for the UI.
 *
 * Returns `null` when there is nothing to compare — an empty query, or two
 * identical texts — so the caller can show "no changes" instead of an empty
 * diff.
 */
export function compareSnapshotWithLive(
  snapshot: Uint8Array,
  liveDoc: Y.Doc,
): { chunks: DiffChunk[]; summary: DiffSummary } | null {
  const snapshotText = decodeSnapshotToText(snapshot);
  const liveText = getLiveDocumentText(liveDoc);

  if (snapshotText === liveText) return null;

  const chunks = computeTextDiff(snapshotText, liveText);
  return { chunks, summary: summarizeDiff(chunks) };
}
