/**
 * Client-side file download and clipboard helpers for document export.
 *
 * Everything here is deliberately dependency-free and synchronous: the
 * exported content is already a string in memory, so there is nothing to
 * stream and no reason to pull in a file-saver library.
 */

/**
 * Characters Windows forbids in a filename, plus C0 control characters.
 *
 * Space and hyphen are deliberately *not* in this set: both are legal and
 * common in document titles, and stripping them would mangle every exported
 * name. A literal control character range is used rather than `\x00-\x1f`
 * escaping so the pattern stays readable.
 */
const ILLEGAL_FILENAME_CHARS = new RegExp('[<>:"/\\\\|?*\\u0000-\\u001F]', "g");

/** Device names Windows reserves regardless of extension. */
const RESERVED_NAMES = new Set([
  "con", "prn", "aux", "nul",
  "com1", "com2", "com3", "com4", "com5", "com6", "com7", "com8", "com9",
  "lpt1", "lpt2", "lpt3", "lpt4", "lpt5", "lpt6", "lpt7", "lpt8", "lpt9",
]);

const FALLBACK_FILENAME = "Untitled document";
/** Leaves room for the extension inside the common 255-byte limit. */
const MAX_BASENAME_LENGTH = 120;

/**
 * Turns a document title into a safe, portable filename stem.
 *
 * Titles are free text, so this has to survive slashes, Windows device names,
 * leading dots, trailing dots and spaces (which Windows silently strips,
 * producing a file with no extension), and very long titles. It never returns
 * an empty string or a path.
 */
export function sanitizeFilename(title: string): string {
  // Collapse whitespace — including the non-breaking spaces people paste in —
  // then trim, before any substitution so the length cap is meaningful.
  const collapsed = (title ?? "").replace(/\s+/g, " ").trim();

  if (!collapsed) return FALLBACK_FILENAME;

  const cleaned = collapsed
    .replace(ILLEGAL_FILENAME_CHARS, "-")
    // Windows silently drops trailing dots and spaces, which would eat the
    // extension, so they have to go before the file is ever created.
    .replace(/^[.\s-]+/, "")
    .replace(/[.\s]+$/, "")
    .slice(0, MAX_BASENAME_LENGTH)
    // The slice can land us back on a trailing separator.
    .replace(/[.\s]+$/, "")
    .trim();

  if (!cleaned) return FALLBACK_FILENAME;
  if (RESERVED_NAMES.has(cleaned.toLowerCase())) return `${cleaned}-document`;

  return cleaned;
}

/** Builds the download filename for a document in `format`. */
export function exportFilename(title: string, format: "md" | "html"): string {
  return `${sanitizeFilename(title)}.${format}`;
}

export interface DownloadOptions {
  content: string;
  filename: string;
  mimeType: string;
}

/**
 * Triggers a browser download for an in-memory string.
 *
 * The object URL is revoked on the next macrotask rather than immediately:
 * revoking synchronously can race the download in some browsers, which then
 * produces an empty or failed file.
 */
export function downloadTextFile({
  content,
  filename,
  mimeType,
}: DownloadOptions): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  anchor.style.display = "none";

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}

/**
 * Copies text to the clipboard.
 *
 * Returns `false` rather than throwing when the Clipboard API is unavailable
 * or denied (an insecure origin, or a permission the user refused), so the
 * caller can show an honest failure state instead of a generic error.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      return false;
    }
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export const EXPORT_MIME = {
  md: "text/markdown",
  html: "text/html",
} as const;
