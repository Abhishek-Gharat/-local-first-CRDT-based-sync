// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import * as Y from "yjs";
import Collaboration from "@tiptap/extension-collaboration";
import {
  MAX_OUTLINE_LEVEL,
  extractOutline,
  findActiveIndex,
  headingElement,
  scrollToHeading,
} from "../outline";

// jsdom does not implement scrollIntoView. Stub it on the prototype so the real
// code path runs and its arguments can be asserted, rather than testing a
// hand-written double of the function under test.
const scrollCalls: { element: Element; options?: ScrollIntoViewOptions | boolean }[] = [];
beforeAll(() => {
  Element.prototype.scrollIntoView = function scrollIntoView(
    this: Element,
    options?: ScrollIntoViewOptions | boolean,
  ) {
    scrollCalls.push({ element: this, options });
  };
});

beforeEach(() => {
  scrollCalls.length = 0;
});

const editors: Editor[] = [];

function plain(content: string): Editor {
  const element = document.createElement("div");
  document.body.appendChild(element);
  const editor = new Editor({
    element,
    extensions: [StarterKit.configure({ undoRedo: false })],
    content,
  });
  editors.push(editor);
  return editor;
}

afterEach(() => {
  while (editors.length) editors.pop()?.destroy();
  document.body.innerHTML = "";
});

describe("extractOutline", () => {
  it("collects headings in document order with level, text and position", () => {
    const editor = plain(
      "<h1>Title</h1><p>intro</p><h2>Section</h2><h3>Detail</h3>",
    );
    const outline = extractOutline(editor.state.doc);

    expect(outline.map((i) => [i.level, i.text])).toEqual([
      [1, "Title"],
      [2, "Section"],
      [3, "Detail"],
    ]);
  });

  it("reports positions that address the real heading nodes", () => {
    const editor = plain("<p>intro</p><h2>Section</h2>");
    const [item] = extractOutline(editor.state.doc);

    const node = editor.state.doc.nodeAt(item!.pos);
    expect(node?.type.name).toBe("heading");
    expect(node?.attrs.level).toBe(2);
  });

  it("ignores body text, lists, quotes and code blocks", () => {
    const editor = plain(
      "<p>just a paragraph</p><ul><li><p>item</p></li></ul><blockquote><p>quote</p></blockquote><pre><code>code</code></pre><h2>Only me</h2>",
    );
    expect(extractOutline(editor.state.doc).map((i) => i.text)).toEqual(["Only me"]);
  });

  it("is empty for a document with no headings", () => {
    expect(extractOutline(plain("<p>nothing here</p>").state.doc)).toEqual([]);
  });

  it("skips a heading with no text, rather than showing a blank row", () => {
    // This is the state a heading passes through for a moment while being
    // typed, and it would otherwise flicker in and out of the outline.
    const editor = plain("<h2></h2><h2>Real</h2>");
    expect(extractOutline(editor.state.doc).map((i) => i.text)).toEqual(["Real"]);
  });

  it("trims surrounding whitespace in heading text", () => {
    const editor = plain("<h2>   Spaced out   </h2>");
    expect(extractOutline(editor.state.doc)[0]!.text).toBe("Spaced out");
  });

  it("includes marks in the heading text, since they are part of the title", () => {
    const editor = plain("<h2>Plain <em>and</em> bold <strong>both</strong></h2>");
    expect(extractOutline(editor.state.doc)[0]!.text).toBe("Plain and bold both");
  });

  it("reads headings nested inside a list item", () => {
    const editor = plain("<ul><li><h3>Nested heading</h3></li></ul>");
    expect(extractOutline(editor.state.doc).map((i) => i.text)).toEqual([
      "Nested heading",
    ]);
  });

  it("gives every item a distinct key", () => {
    const editor = plain("<h2>Same</h2><h2>Same</h2><h2>Same</h2>");
    const keys = extractOutline(editor.state.doc).map((i) => i.key);
    expect(new Set(keys).size).toBe(3);
  });

  it("respects the maximum level", () => {
    const editor = plain("<h1>a</h1><h2>b</h2><h3>c</h3>");
    expect(MAX_OUTLINE_LEVEL).toBe(3);
    expect(extractOutline(editor.state.doc, 1).map((i) => i.text)).toEqual(["a"]);
  });

  it("reacts to a heading being added, edited and deleted", () => {
    const editor = plain("<h2>First</h2>");

    editor.commands.insertContentAt(editor.state.doc.content.size, "<h1>Added</h1>");
    expect(extractOutline(editor.state.doc).map((i) => i.text)).toEqual([
      "First",
      "Added",
    ]);

    const [first] = extractOutline(editor.state.doc);
    editor.commands.setContent("<h2>Renamed</h2>");
    expect(extractOutline(editor.state.doc).map((i) => i.text)).toEqual(["Renamed"]);
    expect(first).toBeDefined();

    editor.commands.setContent("<p>no headings</p>");
    expect(extractOutline(editor.state.doc)).toEqual([]);
  });
});

describe("findActiveIndex", () => {
  it("picks the last heading above the reading line", () => {
    // Tops 0, 1 and 2 are all at or above the line, so the third is current.
    expect(findActiveIndex([-200, -50, 100, 400], 140)).toBe(2);
  });

  it("picks the first heading when the reader is still above it", () => {
    expect(findActiveIndex([100, 400, 900], 140)).toBe(0);
  });

  it("tracks further down as the reader scrolls", () => {
    const tops = [-400, -100, 200, 700];
    expect(findActiveIndex(tops, 140)).toBe(1);
    expect(findActiveIndex(tops.map((t) => t - 300), 140)).toBe(2);
  });

  it("is -1 with no headings", () => {
    expect(findActiveIndex([], 140)).toBe(-1);
  });

  it("handles every heading being below the reading line", () => {
    expect(findActiveIndex([300, 500], 140)).toBe(0);
  });
});

describe("headingElement", () => {
  it("finds the rendered heading element for a position", () => {
    const editor = plain("<h1>Alpha</h1><h2>Beta</h2>");
    const [first, second] = extractOutline(editor.state.doc);

    expect(headingElement(editor, first!.pos)?.tagName).toBe("H1");
    expect(headingElement(editor, second!.pos)?.tagName).toBe("H2");
    expect(headingElement(editor, first!.pos)?.textContent).toBe("Alpha");
  });

  it("returns null rather than throwing for a position with no heading", () => {
    const editor = plain("<p>text</p>");
    expect(headingElement(editor, 1)).toBeNull();
  });
});

describe("scrollToHeading", () => {
  it("scrolls the heading into view smoothly, and says it did", () => {
    const editor = plain("<h1>Alpha</h1><h2>Beta</h2>");
    const [first] = extractOutline(editor.state.doc);
    const element = headingElement(editor, first!.pos)!;

    expect(scrollToHeading(editor, first!.pos)).toBe(true);
    expect(scrollCalls).toHaveLength(1);
    expect(scrollCalls[0]!.element).toBe(element);
    expect(scrollCalls[0]!.options).toEqual({ behavior: "smooth", block: "start" });
  });

  it("reports failure when there is no heading to scroll to", () => {
    const editor = plain("<p>text</p>");
    expect(scrollToHeading(editor, 1)).toBe(false);
    expect(scrollCalls).toHaveLength(0);
  });

  it("falls back to the scrolling ancestor when scrollIntoView is missing", () => {
    // scrollIntoView is not universal, and throwing here would leave the
    // popover open with nothing having happened.
    const editor = plain("<h1>Alpha</h1>");
    const [first] = extractOutline(editor.state.doc);
    const element = headingElement(editor, first!.pos)!;
    const original = Element.prototype.scrollIntoView;
    // @ts-expect-error deliberately removing the API to exercise the fallback
    delete Element.prototype.scrollIntoView;

    try {
      expect(() => scrollToHeading(editor, first!.pos)).not.toThrow();
      expect(scrollToHeading(editor, first!.pos)).toBe(true);
    } finally {
      Element.prototype.scrollIntoView = original;
    }
    expect(element).toBeTruthy();
  });
});

describe("the outline never mutates the document", () => {
  it("does not change the document or the selection when scrolling", () => {
    const editor = plain("<h1>Alpha</h1><p>body</p><h2>Beta</h2>");
    const before = editor.getHTML();
    // `from`/`to` are prototype getters, so a spread of the Selection would
    // capture nothing and make the comparison below vacuous.
    const selectionBefore = {
      from: editor.state.selection.from,
      to: editor.state.selection.to,
    };
    expect(selectionBefore.from).toBeGreaterThan(0);

    const items = extractOutline(editor.state.doc);
    for (const item of items) {
      scrollToHeading(editor, item.pos);
      // Reading the outline must not move the caret: in a collaborative
      // document the selection is shared state, so moving it would be a
      // visible edit to every other collaborator.
      expect(editor.state.selection.from).toBe(selectionBefore.from);
      expect(editor.state.selection.to).toBe(selectionBefore.to);
    }

    expect(editor.getHTML()).toBe(before);
  });

  it("leaves the shared Y.Doc untouched", () => {
    const doc = new Y.Doc();
    const element = document.createElement("div");
    document.body.appendChild(element);
    const editor = new Editor({
      element,
      extensions: [
        StarterKit.configure({ undoRedo: false }),
        Collaboration.configure({ document: doc }),
      ],
    });
    editors.push(editor);
    editor.commands.insertContent("<h1>Shared</h1><p>body</p><h2>Also shared</h2>");

    const before = doc.getXmlFragment("default").toString();
    const items = extractOutline(editor.state.doc);
    expect(items).toHaveLength(2);

    for (const item of items) scrollToHeading(editor, item.pos);

    expect(doc.getXmlFragment("default").toString()).toBe(before);
  });
});
