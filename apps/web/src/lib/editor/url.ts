/**
 * Link address handling for the editor's link popover.
 *
 * Kept separate from the component so the rules are unit-testable without
 * mounting a popover, and so there is exactly one definition of "is this
 * address safe to put in a document".
 */

/**
 * Schemes a document link may use.
 *
 * Everything else is refused. The important exclusion is `javascript:` (and its
 * relatives `data:` / `vbscript:`), which would turn an ordinary-looking link
 * into script execution for anyone who clicks the exported HTML.
 */
const SAFE_SCHEMES = new Set(["http:", "https:", "mailto:", "tel:"]);

/** RFC 3986 scheme: a letter followed by letters/digits/+/-/. then a colon. */
const SCHEME = /^([a-zA-Z][a-zA-Z\d+\-.]*):/;

/**
 * Normalizes user input into a safe, absolute link address.
 *
 * - `"example.com"` becomes `"https://example.com"`, because a bare host typed
 *   into a link field is almost always meant as https, and `href="example.com"`
 *   would silently resolve as a relative path.
 * - An explicit safe scheme is kept as typed.
 * - An unsafe or unparseable scheme returns `null`, and the caller must refuse
 *   to apply rather than writing the raw value into the document.
 */
export function normalizeUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Protocol-relative ("//host/path") inherits the document's scheme; pinning it
  // to https avoids `https:////host` when the prefix is prepended below.
  if (trimmed.startsWith("//")) return `https:${trimmed}`;

  const match = SCHEME.exec(trimmed);
  const afterScheme = match ? trimmed.slice(match[0].length) : null;

  // "localhost:3000/docs" looks like the "localhost:" scheme followed by a
  // port, but a real scheme is never followed by digits like that. Treating it
  // as a scheme would reject the single most common local-development URL.
  if (match && afterScheme !== null && /^\d/.test(afterScheme)) {
    if (/\s/.test(trimmed)) return null;
    return `https://${trimmed}`;
  }

  if (!match) {
    // No scheme: treat the whole thing as a host (+ optional path/query).
    if (/\s/.test(trimmed)) return null;
    return `https://${trimmed}`;
  }

  const scheme = `${match[1]!.toLowerCase()}:`;
  if (!SAFE_SCHEMES.has(scheme)) return null;

  // http(s) needs an actual host: "https://" and "https:///" are not addresses.
  if (scheme === "http:" || scheme === "https:") {
    const host = afterScheme!.replace(/^\/+/, "");
    if (!host || /\s/.test(host)) return null;
  }

  return trimmed;
}

/** A short, user-facing reason a value was refused, or `null` if it is fine. */
export function urlProblem(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (normalizeUrl(trimmed)) return null;

  const match = SCHEME.exec(trimmed);
  if (match && !SAFE_SCHEMES.has(`${match[1]!.toLowerCase()}:`)) {
    return "That link type isn't allowed.";
  }
  return "Enter a valid web address.";
}

/**
 * Collapses a long address for display in a fixed-width popover, so a pasted
 * tracking URL cannot push the buttons off screen.
 */
export function truncateUrl(url: string, max = 48): string {
  if (url.length <= max) return url;
  const head = Math.ceil((max - 1) / 2);
  const tail = Math.floor((max - 1) / 2);
  return `${url.slice(0, head)}…${url.slice(-tail)}`;
}
