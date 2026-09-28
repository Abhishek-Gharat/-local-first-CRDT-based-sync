"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { Check, ClipboardCopy, Code, FileDown } from "lucide-react";
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { htmlToMarkdown } from "@/lib/export/markdown";
import { buildStandaloneHtmlDocument } from "@/lib/export/html-document";
import {
  EXPORT_MIME,
  copyTextToClipboard,
  downloadTextFile,
  exportFilename,
} from "@/lib/export/download";
import { cn } from "@/lib/utils";

/** Transient confirmation lifetime. Long enough to read, short enough not to linger. */
const FEEDBACK_MS = 2400;

type FeedbackKind = "md" | "html" | "copy";

const FEEDBACK_ANNOUNCE: Record<FeedbackKind, string> = {
  md: "Markdown file downloaded",
  html: "HTML file downloaded",
  copy: "Markdown copied to the clipboard",
};

interface ExportMenuProps {
  documentTitle: string;
  /**
   * The live Tiptap instance. `null` only before the editor has mounted, in
   * which case the whole group is disabled rather than silently doing nothing.
   */
  editor: Editor | null;
}

/**
 * Export section for the editor's "More document actions" menu.
 *
 * Export reads `editor.getHTML()` — the same canonical serialisation the
 * collaborative document already produces — so there is no second source of
 * truth to keep in sync and no network round trip. Both formats are built as
 * strings in the browser and handed to a Blob, which keeps the whole feature
 * dependency-free and instantaneous.
 *
 * Feedback is rendered *inside* each item and the menu is kept open, so a
 * user who exports to two formats at once can see both confirmations rather
 * than having the menu disappear under them. The `aria-live` region carries
 * the same information for screen-reader users, who would otherwise only
 * hear the click.
 */
export function ExportMenu({ documentTitle, editor }: ExportMenuProps) {
  const [feedback, setFeedback] = useState<FeedbackKind | null>(null);
  const [error, setError] = useState(false);
  const timerRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  const flash = useCallback(
    (kind: FeedbackKind) => {
      clearTimer();
      setFeedback(kind);
      setError(false);
      timerRef.current = window.setTimeout(() => {
        setFeedback(null);
        timerRef.current = null;
      }, FEEDBACK_MS);
    },
    [clearTimer],
  );

  const fail = useCallback(() => {
    clearTimer();
    setFeedback(null);
    setError(true);
    timerRef.current = window.setTimeout(() => {
      setError(false);
      timerRef.current = null;
    }, FEEDBACK_MS);
  }, [clearTimer]);

  const toMarkdown = useCallback(
    () => htmlToMarkdown(editor?.getHTML() ?? "", { title: documentTitle }),
    [editor, documentTitle],
  );

  const handleDownloadMarkdown = useCallback(() => {
    if (!editor) return;
    try {
      downloadTextFile({
        content: toMarkdown(),
        filename: exportFilename(documentTitle, "md"),
        mimeType: EXPORT_MIME.md,
      });
      flash("md");
    } catch {
      fail();
    }
  }, [editor, toMarkdown, documentTitle, flash, fail]);

  const handleDownloadHtml = useCallback(() => {
    if (!editor) return;
    try {
      downloadTextFile({
        content: buildStandaloneHtmlDocument({
          title: documentTitle,
          contentHtml: editor.getHTML(),
        }),
        filename: exportFilename(documentTitle, "html"),
        mimeType: EXPORT_MIME.html,
      });
      flash("html");
    } catch {
      fail();
    }
  }, [editor, documentTitle, flash, fail]);

  const handleCopyMarkdown = useCallback(async () => {
    if (!editor) return;
    const copied = await copyTextToClipboard(toMarkdown());
    if (copied) {
      flash("copy");
    } else {
      // Clipboard access can be denied or unavailable on an insecure origin;
      // saying so beats a silent no-op.
      fail();
    }
  }, [editor, toMarkdown, flash, fail]);

  const disabled = !editor;

  return (
    <>
      <DropdownMenuGroup>
        <DropdownMenuLabel>Export</DropdownMenuLabel>

        <DropdownMenuItem
          onClick={handleDownloadMarkdown}
          closeOnClick={false}
          disabled={disabled}
          className="justify-between gap-4"
        >
          <span className="flex items-center gap-1.5">
            {feedback === "md" ? (
              <Check aria-hidden className="size-3.5 text-success" />
            ) : (
              <FileDown aria-hidden className="size-3.5" />
            )}
            Export as Markdown
          </span>
          <span
            className={cn(
              "shrink-0 font-mono text-[10px] text-muted-foreground",
              feedback === "md" && "text-success",
            )}
          >
            {feedback === "md" ? "saved" : ".md"}
          </span>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={handleDownloadHtml}
          closeOnClick={false}
          disabled={disabled}
          className="justify-between gap-4"
        >
          <span className="flex items-center gap-1.5">
            {feedback === "html" ? (
              <Check aria-hidden className="size-3.5 text-success" />
            ) : (
              <Code aria-hidden className="size-3.5" />
            )}
            Export as HTML
          </span>
          <span
            className={cn(
              "shrink-0 font-mono text-[10px] text-muted-foreground",
              feedback === "html" && "text-success",
            )}
          >
            {feedback === "html" ? "saved" : ".html"}
          </span>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => void handleCopyMarkdown()}
          closeOnClick={false}
          disabled={disabled}
          className="justify-between gap-4"
        >
          <span className="flex items-center gap-1.5">
            {feedback === "copy" ? (
              <Check aria-hidden className="size-3.5 text-success" />
            ) : (
              <ClipboardCopy aria-hidden className="size-3.5" />
            )}
            Copy as Markdown
          </span>
          <span
            className={cn(
              "shrink-0 font-mono text-[10px] text-muted-foreground",
              feedback === "copy" && "text-success",
            )}
          >
            {feedback === "copy" ? "copied" : ".md"}
          </span>
        </DropdownMenuItem>

        {error && (
          <p className="px-2 pt-1.5 text-[10px] text-destructive">
            Could not write to the clipboard — check the browser permission.
          </p>
        )}

        {/* Announced to assistive tech; the visible swap above is decorative. */}
        <p aria-live="polite" className="sr-only">
          {error
            ? "Export failed"
            : feedback
              ? FEEDBACK_ANNOUNCE[feedback]
              : ""}
        </p>
      </DropdownMenuGroup>

      <DropdownMenuSeparator />
    </>
  );
}
