"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useEditorState } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import {
  ChevronDown,
  ChevronUp,
  Replace,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { onFindReplaceRequest } from "@/components/editor/find-replace/find-replace-bridge";
import {
  closeFind,
  getFindState,
  replaceAllMatches,
  replaceCurrentMatch,
  setCaseSensitive,
  setQuery,
  stepMatch,
} from "@/components/editor/find-replace/find-replace-extension";

interface FindReplaceBarProps {
  editor: Editor;
}

/**
 * Find and replace for the document.
 *
 * Rendered inside the writing surface rather than the toolbar so it can sit
 * `sticky` under the app bar, over the canvas, without disturbing the
 * formatting controls.
 *
 * Search state deliberately lives in the editor plugin, not in React: the
 * highlight decorations are derived from it on every document change, and a
 * React copy would drift the moment a collaborator edited the text.
 */
export function FindReplaceBar({ editor }: FindReplaceBarProps) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [replacement, setReplacement] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  const searchId = useId();
  const replaceId = useId();

  const plugin = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (!e || e.isDestroyed) {
        return { query: "", caseSensitive: false, matches: [], index: 0, truncated: false };
      }
      return getFindState(e);
    },
  });

  const query = plugin?.query ?? "";
  const matches = plugin?.matches ?? [];
  const index = plugin?.index ?? 0;
  const caseSensitive = plugin?.caseSensitive ?? false;
  const total = matches.length;

  const show = useCallback(() => {
    setOpen(true);
  }, []);

  useEffect(() => onFindReplaceRequest(show), [show]);

  // Focus the search field whenever the bar opens, so typing goes straight
  // into it. Not rAF: it never fires in a throttled tab.
  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    searchRef.current?.select();
  }, [open]);

  const close = useCallback(() => {
    setOpen(false);
    setExpanded(false);
    setReplacement("");
    // Clear the highlights; leaving them behind would tint the whole document
    // after the bar is gone.
    closeFind(editor);
    // Hand the caret back to the document.
    if (!editor.isDestroyed) editor.commands.focus();
  }, [editor]);

  const navigate = useCallback(
    (step: 1 | -1) => {
      if (total === 0) return;
      stepMatch(editor, step);
    },
    [editor, total],
  );

  const doReplace = useCallback(() => {
    replaceCurrentMatch(editor, replacement);
  }, [editor, replacement]);

  const doReplaceAll = useCallback(() => {
    replaceAllMatches(editor, replacement);
    searchRef.current?.focus();
  }, [editor, replacement]);

  if (!open) return null;

  const count = total === 0 ? "No matches" : `${index + 1} of ${total}`;

  return (
    <div
      // The bar is announced as a region so a screen-reader user arriving via
      // ⌘F is told a search field opened, rather than finding focus with no
      // context.
      role="region"
      aria-label="Find and replace in document"
      className="sticky top-14 z-20 ml-auto w-full max-w-xl rounded-xl border border-border bg-card/95 p-2 shadow-md backdrop-blur-md supports-[backdrop-filter]:bg-card/80"
    >
      <div className="flex flex-col gap-2">
        {/* ── Search row ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-1.5">
          <div className="relative min-w-0 flex-1">
            <label htmlFor={searchId} className="sr-only">
              Find in document
            </label>
            <Input
              id={searchId}
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(editor, event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  // Enter searches *forwards*; Shift+Enter is the way back.
                  navigate(event.shiftKey ? -1 : 1);
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  close();
                }
              }}
              placeholder="Find in document…"
              autoComplete="off"
              spellCheck={false}
              className="pr-2"
            />
          </div>

          <span
            // Announced as the user types, but not a live region that fires on
            // every keystroke of the query itself — that would be unusable.
            data-slot="find-count"
            aria-live="polite"
            aria-atomic="true"
            className={cn(
              "w-24 shrink-0 text-center text-[11px] tabular-nums",
              total === 0 && query ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {query ? count : ""}
          </span>

          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label="Match case"
            aria-pressed={caseSensitive}
            onClick={() => setCaseSensitive(editor, !caseSensitive)}
            className={cn(
              "size-7 shrink-0 text-[11px] font-semibold",
              caseSensitive && "bg-primary/12 text-primary hover:bg-primary/16",
            )}
          >
            Aa
          </Button>

          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label="Previous match"
            disabled={total === 0}
            onClick={() => navigate(-1)}
            className="size-7 shrink-0"
          >
            <ChevronUp aria-hidden className="size-3.5" />
          </Button>

          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label="Next match"
            disabled={total === 0}
            onClick={() => navigate(1)}
            className="size-7 shrink-0"
          >
            <ChevronDown aria-hidden className="size-3.5" />
          </Button>

          <Button
            type="button"
            size="icon-sm"
            variant={expanded ? "secondary" : "ghost"}
            // Named for what it does, not "Replace": the action button below is
            // already called Replace, and two controls sharing an accessible
            // name is ambiguous for a screen-reader user.
            aria-label={expanded ? "Hide replace options" : "Show replace options"}
            aria-expanded={expanded}
            aria-controls={replaceId}
            onClick={() => {
              const next = !expanded;
              setExpanded(next);
              if (next) {
                // Let the expander render before moving focus into it.
                window.setTimeout(() => replaceRef.current?.focus(), 0);
              }
            }}
            className="size-7 shrink-0"
          >
            <Replace aria-hidden className="size-3.5" />
          </Button>

          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label="Close find and replace"
            onClick={close}
            className="size-7 shrink-0"
          >
            <X aria-hidden className="size-3.5" />
          </Button>
        </div>

        {/* ── Replace row ────────────────────────────────────────────── */}
        {expanded && (
          <div className="flex items-center gap-1.5">
            <div className="relative min-w-0 flex-1">
              <label htmlFor={replaceId} className="sr-only">
                Replace with
              </label>
              <Input
                id={replaceId}
                ref={replaceRef}
                value={replacement}
                onChange={(event) => setReplacement(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    doReplace();
                  } else if (event.key === "Escape") {
                    event.preventDefault();
                    close();
                  }
                }}
                placeholder="Replace with…"
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={total === 0}
              onClick={doReplace}
              className="shrink-0"
            >
              Replace
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={total === 0}
              onClick={doReplaceAll}
              className="shrink-0"
            >
              Replace all
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
