// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import {
  MATCH_LIMIT,
  clampIndex,
  findMatches,
  indexOfMatchAtOrAfter,
  wrapIndex,
} from "../search-core";

function editorFor(content: string | object): Editor {
  const element = document.createElement("div");
  document.body.appendChild(element);
  return new Editor({
    element,
    extensions: [StarterKit.configure({ undoRedo: false })],
    content,
  });
}

/** The text each reported range actually covers, for readable assertions. */
function textsAt(editor: Editor, ranges: { from: number; to: number }[]): string[] {
  return ranges.map((r) => editor.state.doc.textBetween(r.from, r.to));
}

describe("findMatches", () => {
  it("finds every occurrence and reports document ranges", () => {
    const editor = editorFor("<p>cat bat cat</p>");
    const matches = findMatches(editor.state.doc, { query: "cat" });

    expect(textsAt(editor, matches)).toEqual(["cat", "cat"]);
  });

  it("is case-insensitive by default, and case-exact when asked", () => {
    const editor = editorFor("<p>Cat cat CAT</p>");

    expect(findMatches(editor.state.doc, { query: "cat" })).toHaveLength(3);
    expect(
      findMatches(editor.state.doc, { query: "cat", caseSensitive: true }),
    ).toHaveLength(1);
  });

  it("matches across a mark boundary, because a textblock reads as one run", () => {
    // "fo|o" split by a bold boundary is one word to a reader; searching per
    // text node would miss it.
    const editor = editorFor("<p>fo<b>o</b>bar</p>");
    const matches = findMatches(editor.state.doc, { query: "foobar" });
    expect(textsAt(editor, matches)).toEqual(["foobar"]);
  });

  it("does not match across a block boundary", () => {
    // Documented trade-off: nobody types a query spanning a paragraph break.
    const editor = editorFor("<p>hello</p><p>world</p>");
    expect(findMatches(editor.state.doc, { query: "hello world" })).toEqual([]);
  });

  it("searches inside list items, headings and quotes", () => {
    const editor = editorFor(
      "<h1>Target heading</h1><ul><li><p>Target item</p></li></ul><blockquote><p>Target quote</p></blockquote>",
    );
    expect(findMatches(editor.state.doc, { query: "target" })).toHaveLength(3);
  });

  it("does not overlap matches, so ranges never cover the same characters twice", () => {
    const editor = editorFor("<p>aaaa</p>");
    const matches = findMatches(editor.state.doc, { query: "aa" });
    expect(matches).toHaveLength(2);
    expect(matches[0]!.to).toBe(matches[1]!.from);
  });

  it("returns nothing for an empty query rather than matching everywhere", () => {
    const editor = editorFor("<p>anything at all</p>");
    expect(findMatches(editor.state.doc, { query: "" })).toEqual([]);
  });

  it("respects a limit so a one-character query cannot lock up the editor", () => {
    const editor = editorFor(`<p>${"a ".repeat(200)}</p>`);
    const matches = findMatches(editor.state.doc, { query: "a", limit: 10 });
    expect(matches).toHaveLength(10);
    expect(MATCH_LIMIT).toBeGreaterThan(1000);
  });

  it("keeps positions aligned when a block contains an inline leaf", () => {
    // The leaf is replaced by a placeholder character, so every later match
    // must be shifted by the leaf's position too.
    const editor = editorFor('<p>find me<img src="x"> find me</p>');
    const matches = findMatches(editor.state.doc, { query: "find" });
    expect(matches).toHaveLength(2);
    for (const match of matches) {
      expect(editor.state.doc.textBetween(match.from, match.to)).toBe("find");
    }
  });
});

describe("clampIndex", () => {
  it("keeps the index inside the available matches", () => {
    expect(clampIndex(5, 3)).toBe(2);
    expect(clampIndex(-2, 3)).toBe(0);
    expect(clampIndex(1, 3)).toBe(1);
  });

  it("is 0 when there is nothing to point at", () => {
    expect(clampIndex(3, 0)).toBe(0);
  });
});

describe("wrapIndex", () => {
  it("wraps past the end back to the first match", () => {
    expect(wrapIndex(2, 3, 1)).toBe(0);
  });

  it("wraps before the start round to the last match", () => {
    expect(wrapIndex(0, 3, -1)).toBe(2);
  });

  it("moves within the range otherwise", () => {
    expect(wrapIndex(0, 3, 1)).toBe(1);
    expect(wrapIndex(2, 3, -1)).toBe(1);
  });

  it("is inert with no matches", () => {
    expect(wrapIndex(0, 0, 1)).toBe(0);
    expect(wrapIndex(0, 0, -1)).toBe(0);
  });
});

describe("indexOfMatchAtOrAfter", () => {
  const matches = [
    { from: 1, to: 4 },
    { from: 10, to: 14 },
    { from: 20, to: 24 },
  ];

  it("picks the match the caret is inside", () => {
    expect(indexOfMatchAtOrAfter(matches, 12)).toBe(1);
  });

  it("picks the next match when the caret is between two", () => {
    expect(indexOfMatchAtOrAfter(matches, 6)).toBe(1);
  });

  it("falls back to the first when the caret is past every match", () => {
    expect(indexOfMatchAtOrAfter(matches, 99)).toBe(0);
  });

  it("is 0 with no matches", () => {
    expect(indexOfMatchAtOrAfter([], 5)).toBe(0);
  });
});
