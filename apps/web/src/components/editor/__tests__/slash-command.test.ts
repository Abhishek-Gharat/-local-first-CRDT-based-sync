// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { SLASH_COMMANDS, SlashCommand } from "@/lib/editor/slash-command-extension";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Callout } from "@/lib/editor/callout-extension";

describe("SlashCommand extension & commands list", () => {
  it("contains curated commands with titles, descriptions, and categories", () => {
    expect(SLASH_COMMANDS.length).toBeGreaterThan(8);

    const codeCmd = SLASH_COMMANDS.find((c) => c.title === "Code block");
    expect(codeCmd).toBeDefined();
    expect(codeCmd?.aliases).toContain("terminal");
    expect(codeCmd?.badge).toBe("```");

    const calloutCmd = SLASH_COMMANDS.find((c) => c.title === "Callout box");
    expect(calloutCmd).toBeDefined();
    expect(calloutCmd?.aliases).toContain("note");
    expect(calloutCmd?.aliases).toContain("tip");
  });

  it("filters commands correctly by aliases and query", () => {
    const filter = (query: string) => {
      const q = query.toLowerCase().trim();
      return SLASH_COMMANDS.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          c.aliases.some((a) => a.toLowerCase().includes(q)),
      );
    };

    const codeMatches = filter("code");
    expect(codeMatches.some((c) => c.title === "Code block")).toBe(true);

    const calloutMatches = filter("tip");
    expect(calloutMatches.some((c) => c.title === "Callout box")).toBe(true);

    const headingMatches = filter("h1");
    expect(headingMatches.some((c) => c.title === "Heading 1")).toBe(true);
  });

  it("registers SlashCommand extension in Editor without errors", () => {
    const editor = new Editor({
      extensions: [StarterKit, Callout, SlashCommand],
      content: "<p>/</p>",
    });

    expect(editor.extensionManager.extensions.some((e) => e.name === "slashCommand")).toBe(true);
    editor.destroy();
  });
});
