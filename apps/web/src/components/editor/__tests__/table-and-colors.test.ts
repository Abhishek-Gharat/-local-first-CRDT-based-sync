// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { Highlight } from "@tiptap/extension-highlight";
import { TEXT_COLORS, HIGHLIGHT_COLORS } from "@/lib/editor/colors";

describe("Table extension", () => {
  it("inserts a 3x3 table with header row", () => {
    const editor = new Editor({
      extensions: [
        StarterKit,
        Table.configure({ resizable: true }),
        TableRow,
        TableHeader,
        TableCell,
      ],
      content: "<p>Before table</p>",
    });

    editor.commands.insertTable({ rows: 3, cols: 3, withHeaderRow: true });
    const json = editor.getJSON();
    const tableNode = json.content?.find((n) => n.type === "table");
    expect(tableNode).toBeDefined();

    // 3 rows
    expect(tableNode?.content?.length).toBe(3);

    // First row has header cells
    const firstRow = tableNode?.content?.[0] as { type?: string; content?: { type?: string }[] } | undefined;
    expect(firstRow?.type).toBe("tableRow");
    expect(firstRow?.content?.[0]?.type).toBe("tableHeader");

    editor.destroy();
  });

  it("adds and deletes rows in a table", () => {
    const editor = new Editor({
      extensions: [StarterKit, Table, TableRow, TableHeader, TableCell],
      content:
        "<table><tr><th><p>Header</p></th></tr><tr><td><p>Row 1</p></td></tr></table>",
    });

    editor.commands.focus("start");
    expect(editor.isActive("table")).toBe(true);

    editor.commands.addRowAfter();
    let json = editor.getJSON();
    let table = json.content?.find((n) => n.type === "table");
    expect(table?.content?.length).toBe(3);

    editor.commands.deleteRow();
    json = editor.getJSON();
    table = json.content?.find((n) => n.type === "table");
    expect(table?.content?.length).toBe(2);

    editor.destroy();
  });
});

describe("Color & Highlight extensions", () => {
  it("has curated color and highlight swatch palettes", () => {
    expect(TEXT_COLORS.length).toBeGreaterThan(5);
    expect(HIGHLIGHT_COLORS.length).toBeGreaterThan(5);

    const blue = TEXT_COLORS.find((c) => c.label === "Blue");
    expect(blue?.value).toBe("#3b82f6");

    const yellow = HIGHLIGHT_COLORS.find((c) => c.label === "Yellow");
    expect(yellow?.value).toBe("#fef08a");
  });

  it("applies text color mark to selection", () => {
    const editor = new Editor({
      extensions: [StarterKit, TextStyle, Color],
      content: "<p>Colored phrase</p>",
    });

    editor.commands.selectAll();
    editor.commands.setColor("#3b82f6");

    const html = editor.getHTML();
    expect(html).toContain('color: rgb(59, 130, 246)');

    editor.commands.unsetColor();
    expect(editor.getHTML()).not.toContain('color: rgb(59, 130, 246)');

    editor.destroy();
  });

  it("applies background highlight mark to selection", () => {
    const editor = new Editor({
      extensions: [StarterKit, Highlight.configure({ multicolor: true })],
      content: "<p>Highlighted phrase</p>",
    });

    editor.commands.selectAll();
    editor.commands.setHighlight({ color: "#fef08a" });

    const html = editor.getHTML();
    expect(html).toContain("data-color");
    expect(html).toContain("#fef08a");

    editor.commands.unsetHighlight();
    expect(editor.getHTML()).not.toContain("#fef08a");

    editor.destroy();
  });
});
