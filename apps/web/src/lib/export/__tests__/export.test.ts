// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { htmlToMarkdown } from "../markdown";
import { buildStandaloneHtmlDocument, escapeHtml } from "../html-document";
import { exportFilename, sanitizeFilename } from "../download";

describe("htmlToMarkdown", () => {
  const convert = (html: string, title?: string | false) =>
    htmlToMarkdown(html, { title: title === undefined ? false : title });

  it("converts headings to the matching ATX level", () => {
    expect(convert("<h1>One</h1><h2>Two</h2><h3>Three</h3>")).toBe(
      "# One\n\n## Two\n\n### Three",
    );
  });

  it("converts inline marks", () => {
    expect(
      convert(
        "<p><strong>bold</strong> <em>italic</em> <s>struck</s> <code>code</code></p>",
      ),
    ).toBe("**bold** *italic* ~~struck~~ `code`");
  });

  it("pads bold/italic markers when the content touches them", () => {
    // Without padding, **a**b would re-parse as a single bold run.
    expect(convert("<p><strong>a</strong>b</p>")).toBe("**a**b");
    expect(convert("<p><em>a</em>b</p>")).toBe("*a*b");
  });

  it("converts bullet lists, unwrapping Tiptap's paragraph wrappers", () => {
    expect(
      convert("<ul><li><p>one</p></li><li><p>two</p></li></ul>"),
    ).toBe("- one\n- two");
  });

  it("converts ordered lists and honours a start offset", () => {
    expect(
      convert("<ol><li><p>alpha</p></li><li><p>beta</p></li></ol>"),
    ).toBe("1. alpha\n2. beta");
    expect(
      convert('<ol start="3"><li><p>gamma</p></li></ol>'),
    ).toBe("3. gamma");
  });

  it("indents a nested list under its parent item", () => {
    const html =
      "<ul><li><p>outer</p><ul><li><p>inner</p></li></ul></li><li><p>second</p></li></ul>";
    expect(convert(html)).toBe("- outer\n  - inner\n- second");
  });

  it("converts blockquotes, keeping the prefix on every line", () => {
    expect(convert("<blockquote><p>quoted</p></blockquote>")).toBe(
      "> quoted",
    );
  });

  it("converts code blocks to a fenced block and reads the language", () => {
    const html =
      '<pre><code class="language-ts">const x = 1;\n</code></pre>';
    expect(convert(html)).toBe("```ts\nconst x = 1;\n```");
  });

  it("grows the fence past any backticks inside the code", () => {
    const html = "<pre><code>a ``` b</code></pre>";
    expect(convert(html)).toBe("````\na ``` b\n````");
  });

  it("converts dividers, links and hard breaks", () => {
    expect(convert("<hr>")).toBe("---");
    expect(convert('<p><a href="https://example.com">link</a></p>')).toBe(
      "[link](https://example.com)",
    );
    expect(convert("<p>one<br>two</p>")).toBe("one  \ntwo");
  });

  it("escapes characters that would otherwise be re-parsed as syntax", () => {
    expect(convert("<p>a * b</p>")).toBe("a \\* b");
    expect(convert("<p>[bracketed]</p>")).toBe("\\[bracketed\\]");
    // `_` is left alone: CommonMark does not emphasise intraword underscores.
    expect(convert("<p>sync_token</p>")).toBe("sync_token");
  });

  it("prepends the title as an h1, and omits it when asked", () => {
    expect(htmlToMarkdown("<p>body</p>", { title: "My Doc" })).toBe(
      "# My Doc\n\nbody",
    );
    expect(htmlToMarkdown("<p>body</p>", { title: false })).toBe("body");
  });

  it("collapses the blank-line runs ProseMirror emits between blocks", () => {
    expect(convert("<p>a</p>\n\n\n<p>b</p>")).toBe("a\n\nb");
  });

  it("degrades unknown nodes to their text instead of dropping content", () => {
    expect(convert("<p>keep <mark>this</mark></p>")).toBe("keep this");
  });

  it("returns an empty string for an empty document", () => {
    expect(convert("")).toBe("");
    expect(convert("<p></p>")).toBe("");
  });
});

describe("sanitizeFilename", () => {
  it("keeps ordinary titles untouched, including spaces and hyphens", () => {
    expect(sanitizeFilename("Q3 platform roadmap")).toBe(
      "Q3 platform roadmap",
    );
    expect(sanitizeFilename("Notes - draft (v2)")).toBe("Notes - draft (v2)");
  });

  it("replaces characters that are illegal in a filename", () => {
    expect(sanitizeFilename("a/b\\c:d*e?f")).toBe("a-b-c-d-e-f");
    expect(sanitizeFilename('report "final"')).toBe("report -final-");
  });

  it("never returns a path or an empty string", () => {
    expect(sanitizeFilename("../../etc/passwd")).not.toContain("/");
    expect(sanitizeFilename("")).toBe("Untitled document");
    expect(sanitizeFilename("   ")).toBe("Untitled document");
    expect(sanitizeFilename("///")).toBe("Untitled document");
  });

  it("strips leading and trailing dots and spaces, which Windows would eat", () => {
    expect(sanitizeFilename("  ...report...  ")).toBe("report");
  });

  it("avoids Windows reserved device names", () => {
    expect(sanitizeFilename("CON")).toBe("CON-document");
    expect(sanitizeFilename("lpt1")).toBe("lpt1-document");
  });

  it("caps the length and never ends on a separator", () => {
    const long = `${"a".repeat(200)}. `;
    const result = sanitizeFilename(long);
    expect(result.length).toBeLessThanOrEqual(120);
    expect(result.endsWith(".") || result.endsWith(" ")).toBe(false);
  });

  it("builds the export filename with the right extension", () => {
    expect(exportFilename("My Doc", "md")).toBe("My Doc.md");
    expect(exportFilename("My Doc", "html")).toBe("My Doc.html");
    expect(exportFilename("", "md")).toBe("Untitled document.md");
  });
});

describe("buildStandaloneHtmlDocument", () => {
  it("produces a self-contained document with no external references", () => {
    const doc = buildStandaloneHtmlDocument({
      title: "My Doc",
      contentHtml: "<p>Hello</p>",
      exportedAt: new Date("2026-01-15T10:00:00Z"),
    });

    expect(doc.startsWith("<!doctype html>")).toBe(true);
    expect(doc).toContain("<title>My Doc</title>");
    expect(doc).toContain("<p>Hello</p>");
    // No network dependency of any kind.
    expect(doc).not.toMatch(/<link\b/);
    expect(doc).not.toMatch(/<script\b/);
    expect(doc).not.toMatch(/@import/);
    expect(doc).not.toMatch(/https?:\/\/[^"']*\.(css|js|woff)/);
  });

  it("escapes the title so it cannot break out of its element", () => {
    const doc = buildStandaloneHtmlDocument({
      title: '</title><script>alert(1)</script>',
      contentHtml: "<p>x</p>",
    });
    expect(doc).not.toContain("<script>alert(1)</script>");
    expect(doc).toContain("&lt;script&gt;");
  });

  it("carries the export date and attribution in the footer", () => {
    const doc = buildStandaloneHtmlDocument({
      title: "My Doc",
      contentHtml: "",
      exportedAt: new Date("2026-01-15T10:00:00Z"),
      source: "docsync",
    });
    expect(doc).toContain("Exported from docsync on 2026-01-15.");
  });

  it("escapeHtml covers the five significant characters", () => {
    expect(escapeHtml(`<>&"'`)).toBe("&lt;&gt;&amp;&quot;&#39;");
  });
});
