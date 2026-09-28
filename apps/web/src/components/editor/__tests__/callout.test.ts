// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Callout } from "@/lib/editor/callout-extension";
import { htmlToMarkdown } from "@/lib/export/markdown";

describe("Callout extension", () => {
  it("creates a callout node with default type 'note'", () => {
    const editor = new Editor({
      extensions: [StarterKit, Callout],
      content: '<div data-type="callout" data-callout-type="note"><p>Important note</p></div>',
    });

    const json = editor.getJSON();
    const calloutNode = json.content?.[0];
    expect(calloutNode?.type).toBe("callout");
    expect(calloutNode?.attrs?.type).toBe("note");
    expect(editor.getText()).toContain("Important note");

    editor.destroy();
  });

  it("supports updating callout type between note, tip, warning, danger", () => {
    const editor = new Editor({
      extensions: [StarterKit, Callout],
      content: '<div data-type="callout" data-callout-type="note"><p>Alert message</p></div>',
    });

    editor.commands.updateAttributes("callout", { type: "warning" });
    let json = editor.getJSON();
    expect(json.content?.[0]?.attrs?.type).toBe("warning");

    editor.commands.updateAttributes("callout", { type: "tip" });
    json = editor.getJSON();
    expect(json.content?.[0]?.attrs?.type).toBe("tip");

    editor.commands.updateAttributes("callout", { type: "danger" });
    json = editor.getJSON();
    expect(json.content?.[0]?.attrs?.type).toBe("danger");

    editor.destroy();
  });

  it("toggles wrap and unwrap of callout block", () => {
    const editor = new Editor({
      extensions: [StarterKit, Callout],
      content: "<p>Paragraph to wrap</p>",
    });

    editor.commands.selectAll();
    editor.commands.toggleCallout({ type: "tip" });

    let json = editor.getJSON();
    expect(json.content?.[0]?.type).toBe("callout");
    expect(json.content?.[0]?.attrs?.type).toBe("tip");

    // Caret inside the callout
    editor.commands.focus("start");
    editor.commands.toggleCallout();
    json = editor.getJSON();
    expect(json.content?.[0]?.type).toBe("paragraph");

    editor.destroy();
  });

  it("exports callout boxes to standard GitHub-style markdown alerts", () => {
    const html =
      '<div data-type="callout" data-callout-type="warning"><p>Be careful with credentials!</p></div>';
    const md = htmlToMarkdown(html, { title: false });
    expect(md).toContain("> [!WARNING]");
    expect(md).toContain("> Be careful with credentials!");
  });

  it("exports tip callout boxes to > [!TIP] markdown alerts", () => {
    const html =
      '<div data-type="callout" data-callout-type="tip"><p>Use keyboard shortcuts for speed.</p></div>';
    const md = htmlToMarkdown(html, { title: false });
    expect(md).toContain("> [!TIP]");
    expect(md).toContain("> Use keyboard shortcuts for speed.");
  });
});
