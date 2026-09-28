"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useEditorState } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import { ExternalLink, Link2, Pencil, Trash2 } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { findShortcut, formatShortcut } from "@/lib/keyboard/shortcuts";
import { useIsMac } from "@/lib/keyboard/use-is-mac";
import { normalizeUrl, truncateUrl, urlProblem } from "@/lib/editor/url";
import { cn } from "@/lib/utils";
import {
  currentLinkHref,
  prepareLinkSelection,
  selectionRect,
  type SelectionRect,
} from "@/components/editor/link-selection";
import { onLinkPopoverRequest } from "@/components/editor/link-popover-bridge";

interface LinkPopoverProps {
  editor: Editor;
}

/**
 * Which face of the popover is showing.
 *
 *  - `add`    no link here yet, so the field is empty and focused
 *  - `view`   a link exists; show it with Edit / Remove
 *  - `edit`   a link exists and the user asked to change it
 */
type LinkMode = "add" | "view" | "edit";

/**
 * Toolbar button + popover for creating, editing and removing a link.
 *
 * Opens two ways, and that is the whole reason this is one component rather
 * than a plain toolbar button:
 *
 *   - **clicked** — anchored to the toolbar button;
 *   - **`⌘K`/`Ctrl+K`** — anchored to the current text selection, via the
 *     keymap bridge in `link-popover-bridge.ts`.
 *
 * In both cases the editor selection is widened before the popover opens (see
 * `prepareLinkSelection`) so there is always real text for the mark to cover,
 * and focus is returned to the canvas on close so typing continues where it
 * left off.
 */
export function LinkPopover({ editor }: LinkPopoverProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<LinkMode>("add");
  const [value, setValue] = useState("");
  const [anchorRect, setAnchorRect] = useState<SelectionRect | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fieldId = useId();
  const errorId = useId();
  const isMac = useIsMac();

  // The trigger's pressed state and the "is there already a link" question
  // both come from editor state, so they track the caret rather than whatever
  // was true when the popover last closed.
  const linkActive = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      try {
        return e.isActive("link") ?? false;
      } catch {
        return false;
      }
    },
  });

  const openForSelection = useCallback(() => {
    if (editor.isDestroyed || !editor.isEditable) return;

    prepareLinkSelection(editor);

    const existing = currentLinkHref(editor);
    // Freeze the rect at open time: once focus moves into the popover the
    // selection anchor is no longer meaningful, and a live getter would let the
    // popover drift away from the text it refers to.
    setAnchorRect(selectionRect(editor));
    setValue(existing ?? "");
    setMode(existing ? "view" : "add");
    setOpen(true);
  }, [editor]);

  // `⌘K` arrives here from the Tiptap keymap.
  useEffect(() => onLinkPopoverRequest(openForSelection), [openForSelection]);

  // Land the caret in the field when the user is typing a URL, so they can
  // paste or start typing without reaching for the mouse.
  useEffect(() => {
    if (!open || mode === "view") return;
    // The popover content is portalled, so the field may not be mounted on the
    // first commit. Focus immediately, then again on the next task for the
    // late-mount case. Deliberately not rAF: that never fires in a throttled
    // or background tab, which would silently drop the autofocus.
    inputRef.current?.focus();
    const retry = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(retry);
  }, [open, mode]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next);
      if (next) return;
      setAnchorRect(null);
      // Whatever dismissed it — Escape, Apply, an outside click — the user is
      // editing a document, so give the caret back.
      requestAnimationFrame(() => {
        if (!editor.isDestroyed) editor.commands.focus();
      });
    },
    [editor],
  );

  const problem = useMemo(
    () => (value.trim() ? urlProblem(value) : null),
    [value],
  );
  const canApply = value.trim().length > 0 && !problem;

  const apply = useCallback(
    (event?: React.FormEvent) => {
      event?.preventDefault();
      const href = normalizeUrl(value);
      if (!href || editor.isDestroyed) return;

      editor
        .chain()
        .focus()
        // Grows a caret inside an existing link out to the whole link, so
        // re-applying replaces it instead of nesting a second mark.
        .extendMarkRange("link")
        .setLink({ href })
        .run();
      handleOpenChange(false);
    },
    [editor, handleOpenChange, value],
  );

  const remove = useCallback(() => {
    if (editor.isDestroyed) return;
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    handleOpenChange(false);
  }, [editor, handleOpenChange]);

  const shortcut = formatShortcut(findShortcut("link")?.keys ?? null, isMac);
  // Anchoring to the selection is only meaningful while the popover was opened
  // from the keyboard; left undefined, Base UI anchors to the toolbar button.
  const anchor = useMemo(() => {
    if (!anchorRect) return undefined;
    return {
      getBoundingClientRect: () => ({
        top: anchorRect.top,
        left: anchorRect.left,
        right: anchorRect.right,
        bottom: anchorRect.bottom,
        width: anchorRect.width,
        height: anchorRect.height,
        x: anchorRect.x,
        y: anchorRect.y,
        toJSON: () => ({}),
      }),
    };
  }, [anchorRect]);

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-7"
            aria-label="Link"
            // Popover toggles on click, so the button must not preventDefault
            // its click — only the mousedown, which is what would otherwise
            // blur the canvas and collapse the selection before we can read it.
            onMouseDown={(event) => event.preventDefault()}
          />
        }
        aria-pressed={linkActive}
      >
        <Link2 aria-hidden className="size-3.5" />
      </PopoverTrigger>

      <PopoverContent
        // A popover is a dialog, so it needs an accessible name. Matched to the
        // visible heading in each state so screen-reader users hear the same
        // words as everyone else.
        aria-label={mode === "view" ? "Link" : mode === "edit" ? "Edit link" : "Add link"}
        anchor={anchor}
        // The selection rect is viewport-relative, so the popover must be too —
        // absolute positioning would measure it against the scrolling editor.
        positionMethod="fixed"
        side="bottom"
        align="start"
        className="w-80 p-3"
      >
        {mode === "view" ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <span
                id={`${fieldId}-label`}
                className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase"
              >
                Link
              </span>
              <a
                href={value}
                target="_blank"
                rel="noopener noreferrer"
                title={value}
                className="flex items-center gap-1.5 truncate rounded-md px-1 py-0.5 text-xs text-primary underline underline-offset-2 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <ExternalLink aria-hidden className="size-3 shrink-0" />
                <span className="truncate">{truncateUrl(value)}</span>
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            </div>

            <div className="flex items-center justify-between gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => setMode("edit")}
              >
                <Pencil aria-hidden className="size-3.5" />
                Edit
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                className="gap-1.5"
                onClick={remove}
              >
                <Trash2 aria-hidden className="size-3.5" />
                Remove link
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={apply} className="flex flex-col gap-2.5">
            <label
              htmlFor={fieldId}
              className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase"
            >
              {mode === "edit" ? "Edit link" : "Add link"}
            </label>

            <div className="flex gap-1.5">
              <Input
                id={fieldId}
                ref={inputRef}
                value={value}
                onChange={(event) => {
                  setValue(event.target.value);
                  // Typing over an existing link switches back to creating one
                  // once it no longer matches, so the button label never lies
                  // about what Apply will do.
                  if (mode === "edit" && normalizeUrl(event.target.value) !== normalizeUrl(currentLinkHref(editor) ?? "")) {
                    setMode("add");
                  }
                }}
                placeholder="https://example.com"
                autoComplete="url"
                spellCheck={false}
                inputMode="url"
                aria-invalid={problem ? true : undefined}
                aria-describedby={problem ? errorId : undefined}
                className={cn(problem && "border-destructive")}
              />
              <Button type="submit" size="sm" disabled={!canApply}>
                Apply
              </Button>
            </div>

            {problem && (
              <p id={errorId} role="alert" className="text-xs text-destructive">
                {problem}
              </p>
            )}

            <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <span>Press</span>
              {shortcut.map((key) => (
                <Kbd key={key} className="px-1 py-0 text-[10px]">
                  {key}
                </Kbd>
              ))}
              <span>to toggle links</span>
            </p>
          </form>
        )}
      </PopoverContent>
    </Popover>
  );
}
