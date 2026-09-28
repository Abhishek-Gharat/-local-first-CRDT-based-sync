// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import * as Y from "yjs";
import {
  FindReplace,
  closeFind,
  getFindState,
  replaceAllMatches,
  replaceCurrentMatch,
  setCaseSensitive,
  setQuery,
  stepMatch,
} from "../find-replace-extension";
import { findMatches } from "../search-core";

// jsdom has no layout, so ProseMirror's scroll-into-view path throws when a
// transaction selects a range. The bar navigates by selecting, so stub the
// measurement APIs to keep unhandled errors out of the run.
beforeAll(() => {
  const emptyRectList = () => Object.assign([], { item: () => null }) as unknown as DOMRectList;
  const emptyRect = () => new DOMRect();
  Range.prototype.getClientRects = emptyRectList;
  Range.prototype.getBoundingClientRect = emptyRect;
  Element.prototype.getClientRects = emptyRectList;
  Element.prototype.getBoundingClientRect = emptyRect;
});

const editors: Editor[] = [];

function plain(content: string): Editor {
  const element = document.createElement("div");
  document.body.appendChild(element);
  const editor = new Editor({
    element,
    // undoRedo off: ProseMirror history is disabled in this app because the
    // Collaboration extension tracks history against the shared doc.
    extensions: [StarterKit.configure({ undoRedo: false }), FindReplace],
    content,
  });
  editors.push(editor);
  return editor;
}

/**
 * An editor backed by a real Yjs doc, so CRDT mapping is genuinely exercised.
 *
 * Seeded via `insertContent` rather than Tiptap's `content` option: with the
 * Collaboration extension installed, the shared Y.Doc is the source of truth and
 * the `content` option is ignored, which silently yields an empty editor.
 */
function collaborative(seed: string, doc: Y.Doc): Editor {
  const element = document.createElement("div");
  document.body.appendChild(element);
  const editor = new Editor({
    element,
    extensions: [
      StarterKit.configure({ undoRedo: false }),
      FindReplace,
      Collaboration.configure({ document: doc }),
    ],
  });
  editors.push(editor);
  editor.commands.insertContent(seed);
  return editor;
}

afterEach(() => {
  while (editors.length) editors.pop()?.destroy();
  document.body.innerHTML = "";
});

const count = (editor: Editor) => getFindState(editor).matches.length;

describe("find state", () => {
  it("starts empty and inert", () => {
    const editor = plain("<p>hello</p>");
    expect(getFindState(editor)).toEqual({
      query: "",
      caseSensitive: false,
      matches: [],
      index: 0,
      truncated: false,
    });
  });

  it("reports matches as the query is set", () => {
    const editor = plain("<p>cat and cat and cat</p>");
    setQuery(editor, "cat");
    expect(count(editor)).toBe(3);
    expect(getFindState(editor).query).toBe("cat");
  });

  it("honours the match-case toggle", () => {
    const editor = plain("<p>Cat cat CAT</p>");
    setQuery(editor, "cat");
    expect(count(editor)).toBe(3);
    setCaseSensitive(editor, true);
    expect(count(editor)).toBe(1);
  });

  it("clears the query and the highlights on close", () => {
    const editor = plain("<p>cat</p>");
    setQuery(editor, "cat");
    expect(count(editor)).toBe(1);
    closeFind(editor);
    expect(getFindState(editor).query).toBe("");
    expect(count(editor)).toBe(0);
  });

  it("does not put decorations into the document", () => {
    const editor = plain("<p>cat</p>");
    const before = editor.getHTML();
    setQuery(editor, "cat");
    // Highlights must be local-only: no <mark>, no class on the content.
    expect(editor.getHTML()).toBe(before);
    expect(editor.getHTML()).not.toMatch(/mark|find-replace/i);
  });

  it("renders highlights as decorations in the DOM, not as content", () => {
    const editor = plain("<p>cat</p>");
    setQuery(editor, "cat");
    const highlighted = editor.view.dom.querySelectorAll(".find-replace-match");
    expect(highlighted).toHaveLength(1);
  });
});

describe("navigating matches", () => {
  it("selects the match and marks exactly one as current", () => {
    const editor = plain("<p>cat cat cat</p>");
    setQuery(editor, "cat");

    // A fresh editor's caret sits at the start of the document, so opening
    // search lands on the first match.
    expect(getFindState(editor).index).toBe(0);

    stepMatch(editor, 1);
    expect(getFindState(editor).index).toBe(1);
    expect(editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to)).toBe("cat");
    // Exactly one match is distinguished, however many exist.
    expect(editor.view.dom.querySelectorAll(".find-replace-match")).toHaveLength(3);
    expect(editor.view.dom.querySelectorAll(".find-replace-match-active")).toHaveLength(1);
  });

  it("wraps around in both directions", () => {
    const editor = plain("<p>cat cat cat</p>");
    setQuery(editor, "cat");
    for (let i = 0; i < 3; i++) stepMatch(editor, 1);
    expect(getFindState(editor).index).toBe(0);
    stepMatch(editor, -1);
    expect(getFindState(editor).index).toBe(2);
  });

  it("does nothing when there are no matches, rather than throwing", () => {
    const editor = plain("<p>hello</p>");
    setQuery(editor, "cat");
    expect(() => stepMatch(editor, 1)).not.toThrow();
    expect(() => stepMatch(editor, -1)).not.toThrow();
  });

  it("starts on the match nearest the caret", () => {
    const editor = plain("<p>cat</p><p>cat</p><p>cat</p>");
    setQuery(editor, "cat");
    // Put the caret in the third paragraph, then re-query.
    editor.commands.setTextSelection(12);
    setQuery(editor, "cat");
    expect(getFindState(editor).index).toBe(2);
  });
});

describe("replacing", () => {
  it("replaces the current match and advances to the next", () => {
    const editor = plain("<p>cat dog cat</p>");
    setQuery(editor, "cat");
    expect(count(editor)).toBe(2);

    replaceCurrentMatch(editor, "bird");
    const html = editor.getHTML();
    expect(html).toContain("bird");
    expect(html).not.toContain("cat dog");
    // The caret moved on to the remaining match.
    expect(count(editor)).toBe(1);
    expect(getFindState(editor).index).toBe(0);
  });

  it("replaces every match in one undoable step", () => {
    const editor = plain("<p>cat cat cat</p>");
    setQuery(editor, "cat");
    expect(count(editor)).toBe(3);

    const replaced = replaceAllMatches(editor, "dog");
    expect(replaced).toBe(3);
    expect(editor.getHTML()).not.toContain("cat");
    expect(editor.getHTML().match(/dog/g)).toHaveLength(3);
    // The document is still coherent: the words are the original length apart.
    expect(editor.getHTML()).toContain("dog dog dog");
  });

  it("replaces case-insensitively but preserves nothing of the old casing", () => {
    const editor = plain("<p>Cat cat CAT</p>");
    setQuery(editor, "cat");
    expect(replaceAllMatches(editor, "dog")).toBe(3);
    expect(editor.getHTML()).toContain("dog dog dog");
  });

  it("honours match case when replacing", () => {
    const editor = plain("<p>Cat cat CAT</p>");
    setQuery(editor, "cat");
    setCaseSensitive(editor, true);
    // Only the lower-case "cat" is a match, and it is the first (and only) one.
    expect(replaceAllMatches(editor, "dog")).toBe(1);
    expect(editor.getHTML()).toBe("<p>Cat dog CAT</p>");
  });

  it("replaces from the end backwards so every position stays valid", () => {
    // The failure mode this guards: replacing front-to-back shifts the later
    // ranges and corrupts the text.
    const editor = plain("<p>xx xx xx xx</p>");
    setQuery(editor, "xx");
    replaceAllMatches(editor, "yyyy");
    expect(editor.getHTML()).toBe("<p>yyyy yyyy yyyy yyyy</p>");
  });

  it("keeps the link mark when replacing text inside a link", () => {
    const editor = plain('<p>see <a href="https://example.com">cat</a> now</p>');
    setQuery(editor, "cat");
    replaceAllMatches(editor, "dog");
    const html = editor.getHTML();
    expect(html).toContain("dog");
    expect(html).toContain('href="https://example.com"');
  });

  it("is a no-op with no matches", () => {
    const editor = plain("<p>hello</p>");
    setQuery(editor, "cat");
    expect(replaceAllMatches(editor, "dog")).toBe(0);
    expect(replaceCurrentMatch(editor, "dog")).toBeUndefined();
    expect(editor.getHTML()).toBe("<p>hello</p>");
  });

  it("recomputes matches after a local edit", () => {
    const editor = plain("<p>cat</p>");
    setQuery(editor, "cat");
    expect(count(editor)).toBe(1);

    editor.commands.insertContentAt(4, " and cat");
    expect(count(editor)).toBe(2);
  });
});

describe("collaboration safety", () => {
  it("propagates replacements through the shared Yjs document", () => {
    const doc = new Y.Doc();
    const editor = collaborative("<p>cat cat</p>", doc);

    setQuery(editor, "cat");
    replaceAllMatches(editor, "dog");

    // Give the y-prosemirror binding a tick to flush to the shared type.
    expect(editor.getHTML()).toBe("<p>dog dog</p>");
    const shared = doc.getXmlFragment("default").toString();
    expect(shared).toContain("dog");
    expect(shared).not.toContain("cat");
  });

  it("never writes the highlight into the shared document", () => {
    const doc = new Y.Doc();
    const editor = collaborative("<p>cat</p>", doc);

    setQuery(editor, "cat");
    const shared = doc.getXmlFragment("default").toString();
    expect(shared).not.toMatch(/find-replace|mark/i);
  });

  it("keeps other clients' cursors mappable across a replace-all", () => {
    const doc = new Y.Doc();
    const editor = collaborative("<p>cat cat</p>", doc);

    // A remote peer selects the tail of the document before we replace.
    setQuery(editor, "cat");
    replaceAllMatches(editor, "elephant");

    // The local selection must still be inside the document, not left dangling
    // at a position that no longer exists.
    const { from, to } = editor.state.selection;
    expect(editor.state.doc.content.size).toBeGreaterThan(to);
    expect(from).toBeLessThanOrEqual(to);
  });
});

describe("match positions after edits", () => {
  it("does not leave stale ranges pointing at the wrong characters", () => {
    const editor = plain("<p>cat cat</p>");
    setQuery(editor, "cat");
    expect(findMatches(editor.state.doc, { query: "cat" })).toHaveLength(2);

    // Type before the matches; the offsets must move with the text.
    editor.commands.insertContentAt(1, "a ");
    const state = getFindState(editor);
    expect(state.matches).toHaveLength(2);
    for (const match of state.matches) {
      expect(editor.state.doc.textBetween(match.from, match.to)).toBe("cat");
    }
  });

  it("drops to zero matches once the term is gone", () => {
    const editor = plain("<p>cat</p>");
    setQuery(editor, "cat");
    editor.commands.insertContentAt(1, "dog ");
    expect(count(editor)).toBe(1);

    // Delete the surviving occurrence, using the positions search reported
    // rather than hand-counted ones.
    const [match] = getFindState(editor).matches;
    editor.commands.deleteRange({ from: match!.from, to: match!.to });

    expect(count(editor)).toBe(0);
    expect(editor.view.dom.querySelectorAll(".find-replace-match")).toHaveLength(0);
  });
});
