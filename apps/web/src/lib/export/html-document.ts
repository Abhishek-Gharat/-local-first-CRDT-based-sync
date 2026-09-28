/**
 * Wraps exported editor HTML in a self-contained document.
 *
 * The result has to work when opened from a file:// URL with no network, so
 * there are no external stylesheets, no webfonts and no scripts — the
 * typography is a system font stack and a single inline stylesheet. It also
 * ships light and dark palettes plus print rules, so an exported file is
 * presentable whether it is read on screen or printed.
 */

const STYLESHEET = `
  :root {
    color-scheme: light dark;
    --bg: #ffffff;
    --fg: #16161c;
    --muted: #5b5b66;
    --border: #e6e6ec;
    --code-bg: #f5f5f7;
    --quote: #5252cc;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #16161c;
      --fg: #f2f2f5;
      --muted: #a5a5b2;
      --border: #2c2c36;
      --code-bg: #1e1e26;
      --quote: #a9a9f0;
    }
  }
  *, *::before, *::after { box-sizing: border-box; }
  html { -webkit-text-size-adjust: 100%; }
  body {
    margin: 0;
    padding: 3rem 1.25rem 5rem;
    background: var(--bg);
    color: var(--fg);
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto,
      "Helvetica Neue", Arial, sans-serif;
    font-size: 17px;
    line-height: 1.7;
  }
  main { max-width: 46rem; margin: 0 auto; }
  h1, h2, h3, h4, h5, h6 {
    line-height: 1.25;
    letter-spacing: -0.02em;
    margin: 1.8em 0 0.6em;
    font-weight: 650;
  }
  h1 { font-size: 1.9em; margin-top: 0; }
  h2 { font-size: 1.45em; }
  h3 { font-size: 1.18em; }
  p, ul, ol, blockquote, pre, hr { margin: 0 0 1.1em; }
  ul, ol { padding-left: 1.4em; }
  li + li { margin-top: 0.3em; }
  li::marker { color: var(--muted); }
  a { color: inherit; text-decoration: underline; text-underline-offset: 2px; }
  strong { font-weight: 650; }
  blockquote {
    border-left: 3px solid var(--quote);
    margin-left: 0;
    padding-left: 1em;
    color: var(--muted);
    font-style: italic;
  }
  code {
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas,
      "Liberation Mono", monospace;
    font-size: 0.88em;
    background: var(--code-bg);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 0.12em 0.35em;
  }
  pre {
    background: var(--code-bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 0.9em 1.1em;
    overflow-x: auto;
    line-height: 1.6;
  }
  pre code {
    background: none;
    border: 0;
    padding: 0;
    font-size: 0.85em;
  }
  hr {
    border: 0;
    border-top: 1px solid var(--border);
    margin: 2em 0;
  }
  img { max-width: 100%; height: auto; }
  footer {
    max-width: 46rem;
    margin: 3.5rem auto 0;
    padding-top: 1.25rem;
    border-top: 1px solid var(--border);
    color: var(--muted);
    font-size: 0.78em;
  }
  @media print {
    body { padding: 0; font-size: 11pt; }
    footer { display: none; }
    pre, blockquote { break-inside: avoid; }
    h1, h2, h3 { break-after: avoid; }
  }
`;

/** Escapes text for safe interpolation into HTML text/attribute positions. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface HtmlDocumentOptions {
  /** Rendered as the `<title>` and the page's single `<h1>`. */
  title: string;
  /** `editor.getHTML()` output. */
  contentHtml: string;
  /** Omitted from the markup when absent. */
  exportedAt?: Date;
  /** Attribution line in the footer. Omit for no footer. */
  source?: string;
}

/**
 * Builds a standalone, dependency-free HTML document from editor content.
 *
 * The content is interpolated verbatim because it comes from
 * `editor.getHTML()`, which ProseMirror can only emit for nodes in the
 * editor's own schema — arbitrary user-supplied markup cannot reach it. The
 * title, by contrast, is a free-text document field and *is* escaped.
 */
export function buildStandaloneHtmlDocument({
  title,
  contentHtml,
  exportedAt,
  source = "docsync",
}: HtmlDocumentOptions): string {
  const safeTitle = escapeHtml(title);
  const stamp = exportedAt ?? new Date();

  const footer = [
    `<p>Exported from ${escapeHtml(source)} on ${escapeHtml(
      stamp.toISOString().slice(0, 10),
    )}.</p>`,
  ].join("\n    ");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="generator" content="${escapeHtml(source)}" />
    <title>${safeTitle}</title>
    <style>${STYLESHEET}</style>
  </head>
  <body>
    <main>
      <h1>${safeTitle}</h1>
      ${contentHtml}
    </main>
    <footer>
    ${footer}
    </footer>
  </body>
</html>
`;
}
