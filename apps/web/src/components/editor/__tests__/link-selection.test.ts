// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import {
  currentLinkHref,
  expandCaretToWord,
  prepareLinkSelection,
  selectionRect,
} from "../link-selection";

/**
 * These run against a real ProseMirror instance rather than a mock, because the
 * behaviour worth testing *is* the position arithmetic: "which characters does
 * the link mark end up covering" is a question about document offsets, and a
 * mocked selection cannot answer it.
 */
function createEditor(html: string | object): Editor {
  const element = document.createElement("div");
  document.body.appendChild(element);
  return new Editor({
    element,
    extensions: [
      StarterKit.configure({
        undoRedo: false,
        link: { openOnClick: false, defaultProtocol: "https" },
      }),
    ],
    content: html,
  });
}

const editors: Editor[] = [];

function editorFor(html: string | object): Editor {
  const editor = createEditor(html);
  editors.push(editor);
  return editor;
}

afterEach(() => {
  while (editors.length) editors.pop()?.destroy();
  document.body.innerHTML = "";
});

/** Selects the first `n` characters of the document. */
function selectChars(editor: Editor, from: number, to: number): void {
  editor.commands.setTextSelection({ from, to });
}

describe("currentLinkHref", () => {
  it("reads the href under a selection", () => {
    const editor = editorFor(
      '<p>see <a href="https://example.com">this</a> link</p>',
    );
    selectChars(editor, 5, 9); // inside the anchor text
    expect(currentLinkHref(editor)).toBe("https://example.com");
  });

  it("is undefined where there is no link", () => {
    const editor = editorFor("<p>plain text</p>");
    selectChars(editor, 1, 5);
    expect(currentLinkHref(editor)).toBeUndefined();
  });
});

describe("expandCaretToWord", () => {
  it("selects the word the caret sits inside", () => {
    const editor = editorFor("<p>alpha beta gamma</p>");
    // Caret between "alp" and "ha".
    editor.commands.setTextSelection(4);
    expect(expandCaretToWord(editor)).toBe(true);

    const { from, to } = editor.state.selection;
    expect(editor.state.doc.textBetween(from, to)).toBe("alpha");
  });

  it("selects the following word when the caret sits at its start", () => {
    const editor = editorFor("<p>alpha beta</p>");
    // Position 7 is the first character of "beta"; position 6 is the end of
    // "alpha", which is a different case handled above.
    editor.commands.setTextSelection(7);
    expect(expandCaretToWord(editor)).toBe(true);

    const { from, to } = editor.state.selection;
    expect(editor.state.doc.textBetween(from, to)).toBe("beta");
  });

  it("leaves an existing range untouched", () => {
    const editor = editorFor("<p>alpha beta gamma</p>");
    selectChars(editor, 1, 6);
    expandCaretToWord(editor);
    const { from, to } = editor.state.selection;
    expect(editor.state.doc.textBetween(from, to)).toBe("alpha");
  });

  it("reports failure in a run of whitespace, rather than selecting the spaces", () => {
    // A JSON doc, not HTML: parsing collapses runs of spaces, which would
    // quietly turn this into a different test.
    const editor = editorFor({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "alpha     beta" }] },
      ],
    });
    editor.commands.setTextSelection(8); // inside the spaces
    expect(expandCaretToWord(editor)).toBe(false);
  });

  it("selects the word to the left when the caret is at a word's end", () => {
    const editor = editorFor("<p>alpha beta</p>");
    editor.commands.setTextSelection(6); // end of "alpha"
    expect(expandCaretToWord(editor)).toBe(true);
    const { from, to } = editor.state.selection;
    expect(editor.state.doc.textBetween(from, to)).toBe("alpha");
  });
});

describe("prepareLinkSelection", () => {
  it("grows a bare caret to the word, so ⌘K has something to mark", () => {
    const editor = editorFor("<p>alpha beta</p>");
    editor.commands.setTextSelection(2);
    prepareLinkSelection(editor);
    const { from, to } = editor.state.selection;
    expect(editor.state.doc.textBetween(from, to)).toBe("alpha");
  });

  it("grows a caret inside a link out to the whole link, not just the word", () => {
    // This is the case that makes "Edit" work: re-applying must replace the
    // link rather than nest a second mark on the word under the cursor.
    const editor = editorFor(
      '<p>go <a href="https://old.example.com">to the old docs</a> now</p>',
    );
    // Caret inside "old". Text index + 1 maps into document positions, since a
    // paragraph's content starts at 1.
    const text = editor.state.doc.textBetween(0, editor.state.doc.content.size);
    editor.commands.setTextSelection(text.indexOf("old") + 1);
    expect(editor.isActive("link")).toBe(true);

    prepareLinkSelection(editor);
    const { from, to } = editor.state.selection;
    expect(editor.state.doc.textBetween(from, to)).toBe("to the old docs");
  });

  it("respects a selection the user already made", () => {
    const editor = editorFor("<p>alpha beta gamma</p>");
    selectChars(editor, 7, 11);
    prepareLinkSelection(editor);
    const { from, to } = editor.state.selection;
    expect(editor.state.doc.textBetween(from, to)).toBe("beta");
  });
});

describe("selectionRect", () => {
  it("returns null rather than throwing where layout is unavailable", () => {
    // jsdom has no layout, so coordsAtPos cannot measure. The popover must
    // still open (anchored to its trigger) instead of crashing.
    const editor = editorFor("<p>alpha beta</p>");
    selectChars(editor, 1, 6);
    expect(() => selectionRect(editor)).not.toThrow();
  });
});

describe("link mark round trip", () => {
  it("applies, replaces and removes a link over the prepared selection", () => {
    const editor = editorFor("<p>alpha beta</p>");
    editor.commands.setTextSelection(2);
    prepareLinkSelection(editor);

    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: "https://one.example.com" })
      .run();
    expect(editor.getHTML()).toContain("https://one.example.com");

    // Editing replaces rather than nests: exactly one href survives.
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: "https://two.example.com" })
      .run();
    const html = editor.getHTML();
    expect(html).toContain("https://two.example.com");
    expect(html).not.toContain("https://one.example.com");

    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    expect(editor.getHTML()).not.toContain("<a ");
  });

  it("reports the mark as active for the trigger's pressed state", () => {
    const editor = editorFor(
      '<p><a href="https://example.com">linked</a> plain</p>',
    );
    editor.commands.setTextSelection(2); // inside "linked"
    expect(editor.isActive("link")).toBe(true);

    // Position 0 sits before the paragraph, so ProseMirror clamps it back into
    // the link. Move to genuinely unlinked text instead.
    selectChars(editor, 8, 12); // inside "plain"
    expect(editor.isActive("link")).toBe(false);
  });
});
