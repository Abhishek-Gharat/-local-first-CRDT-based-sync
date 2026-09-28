// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import {
  computeTextDiff,
  compareSnapshotWithLive,
  decodeSnapshotToText,
  getLiveDocumentText,
  summarizeDiff,
  type DiffChunk,
} from "../version-diff";

/**
 * Builds a Yjs document containing a single paragraph, the way the editor's
 * shared document does, so snapshot decoding is exercised against the real
 * fragment name and structure rather than a hand-rolled stand-in.
 */
function docWithParagraph(text: string): Y.Doc {
  const doc = new Y.Doc();
  const fragment = doc.getXmlFragment("default");
  // The editor's document is a ProseMirror doc serialised into an XmlFragment.
  // A paragraph is the simplest node that carries text, and it is enough to
  // prove the snapshot round-trips.
  const paragraph = new Y.XmlElement("paragraph");
  const textNode = new Y.XmlText(text);
  paragraph.insert(0, [textNode]);
  fragment.insert(0, [paragraph]);
  return doc;
}

function snapshotOf(doc: Y.Doc): Uint8Array {
  return Y.encodeStateAsUpdate(doc);
}

describe("computeTextDiff", () => {
  it("marks added and removed words", () => {
    const chunks = computeTextDiff("the quick brown fox", "the quick red fox");

    expect(chunks).toEqual([
      { value: "the quick " },
      { value: "brown", removed: true },
      { value: "red", added: true },
      { value: " fox" },
    ]);
  });

  it("returns a single unchanged chunk for identical text", () => {
    expect(computeTextDiff("same text", "same text")).toEqual([
      { value: "same text" },
    ]);
  });

  it("handles wholesale replacement", () => {
    const chunks = computeTextDiff("old content", "new content");
    expect(chunks.some((c) => c.removed)).toBe(true);
    expect(chunks.some((c) => c.added)).toBe(true);
  });

  it("handles empty inputs", () => {
    // diffWordsWithSpace returns no chunks at all when both sides are empty.
    expect(computeTextDiff("", "")).toEqual([]);
    expect(computeTextDiff("", "new")).toEqual([{ value: "new", added: true }]);
    expect(computeTextDiff("old", "")).toEqual([{ value: "old", removed: true }]);
  });

  it("keeps whitespace attached to the words it belongs to", () => {
    // The point of word-level diffing: unchanged prose stays collapsed instead
    // of being repainted because a neighbouring word changed.
    const chunks = computeTextDiff("alpha beta gamma", "alpha delta gamma");
    const unchanged = chunks.filter((c) => !c.added && !c.removed);
    expect(unchanged.map((c) => c.value)).toContain("alpha ");
    expect(unchanged.map((c) => c.value)).toContain(" gamma");
  });
});

describe("summarizeDiff", () => {
  it("counts added and removed words", () => {
    const chunks: DiffChunk[] = [
      { value: "the " },
      { value: "quick brown", removed: true },
      { value: " fast", added: true },
      { value: " fox" },
    ];
    expect(summarizeDiff(chunks)).toEqual({ addedWords: 1, removedWords: 2 });
  });

  it("ignores whitespace-only chunks", () => {
    expect(summarizeDiff([{ value: "   " }, { value: "\n" }])).toEqual({
      addedWords: 0,
      removedWords: 0,
    });
  });

  it("counts hyphenated words as one", () => {
    expect(summarizeDiff([{ value: "state-of-the-art", added: true }])).toEqual({
      addedWords: 1,
      removedWords: 0,
    });
  });
});

describe("snapshot text extraction", () => {
  it("reads text from a saved snapshot", () => {
    const doc = docWithParagraph("hello from the past");
    expect(decodeSnapshotToText(snapshotOf(doc))).toBe("hello from the past");
  });

  it("reads the live document text", () => {
    const doc = docWithParagraph("current content");
    expect(getLiveDocumentText(doc)).toBe("current content");
  });

  it("does not modify the live document while reading it", () => {
    const doc = docWithParagraph("untouched");
    const before = doc.getXmlFragment("default").toString();
    getLiveDocumentText(doc);
    expect(doc.getXmlFragment("default").toString()).toBe(before);
  });
});

describe("compareSnapshotWithLive", () => {
  it("returns null when the snapshot matches the live document", () => {
    const doc = docWithParagraph("identical");
    expect(compareSnapshotWithLive(snapshotOf(doc), doc)).toBeNull();
  });

  it("diffs a snapshot against the current document", () => {
    const doc = docWithParagraph("first draft");
    const snapshot = snapshotOf(doc);

    // Edit the live document after the snapshot was taken.
    const fragment = doc.getXmlFragment("default");
    const paragraph = fragment.get(0) as Y.XmlElement;
    paragraph.delete(0, paragraph.length);
    paragraph.insert(0, [new Y.XmlText("second draft")]);

    const result = compareSnapshotWithLive(snapshot, doc);
    expect(result).not.toBeNull();
    expect(result!.chunks.some((c) => c.removed && c.value.includes("first"))).toBe(true);
    expect(result!.chunks.some((c) => c.added && c.value.includes("second"))).toBe(true);
    expect(result!.summary).toEqual({ addedWords: 1, removedWords: 1 });
  });

  it("reports additions only when the document grew", () => {
    const doc = docWithParagraph("short");
    const snapshot = snapshotOf(doc);

    const fragment = doc.getXmlFragment("default");
    const paragraph = fragment.get(0) as Y.XmlElement;
    paragraph.delete(0, paragraph.length);
    paragraph.insert(0, [new Y.XmlText("short and much longer now")]);

    const result = compareSnapshotWithLive(snapshot, doc);
    expect(result!.summary.addedWords).toBeGreaterThan(0);
    expect(result!.summary.removedWords).toBe(0);
  });
});
