// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { lowlight, POPULAR_LANGUAGES } from "@/lib/editor/lowlight";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";

describe("syntax-highlighted code block with lowlight", () => {
  it("initializes lowlight with common programming languages", () => {
    const registered = lowlight.listLanguages();
    expect(registered).toContain("typescript");
    expect(registered).toContain("javascript");
    expect(registered).toContain("python");
    expect(registered).toContain("rust");
    expect(registered).toContain("go");
    expect(registered).toContain("sql");
    expect(registered).toContain("xml");
    expect(registered).toContain("css");
    expect(registered).toContain("json");
  });

  it("lists curated popular languages with appropriate labels", () => {
    expect(POPULAR_LANGUAGES.length).toBeGreaterThan(10);
    const ts = POPULAR_LANGUAGES.find((l) => l.value === "typescript");
    expect(ts?.label).toBe("TypeScript");
  });

  it("highlights code tokens inside a CodeBlockLowlight node", () => {
    const editor = new Editor({
      extensions: [
        StarterKit.configure({ codeBlock: false }),
        CodeBlockLowlight.configure({ lowlight }),
      ],
      content: '<pre><code class="language-typescript">const count: number = 42;</code></pre>',
    });

    const json = editor.getJSON();
    const codeNode = json.content?.[0];
    expect(codeNode?.type).toBe("codeBlock");
    expect(codeNode?.attrs?.language).toBe("typescript");

    // Lowlight plugin parses and highlights language tokens
    const tree = lowlight.highlight("typescript", "const count: number = 42;");
    expect(tree.children.length).toBeGreaterThan(0);

    editor.destroy();
  });

  it("allows updating code block language attributes", () => {
    const editor = new Editor({
      extensions: [
        StarterKit.configure({ codeBlock: false }),
        CodeBlockLowlight.configure({ lowlight }),
      ],
      content: "<pre><code>def hello(): pass</code></pre>",
    });

    editor.commands.updateAttributes("codeBlock", { language: "python" });
    const json = editor.getJSON();
    expect(json.content?.[0]?.attrs?.language).toBe("python");

    editor.destroy();
  });
});
