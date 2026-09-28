"use client";

import { useRef, useState } from "react";
import { Loader2, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

interface EditableTitleProps {
  documentId: string;
  initialTitle: string;
  /** viewers see a static heading */
  canRename: boolean;
  /** Set while a rename request is in flight, for the inline spinner. */
  saving?: boolean;
}

/**
 * The document's title, rendered as the page's <h1> at the top of the writing
 * canvas rather than crammed into the app bar.
 *
 * Click-to-edit over the existing PATCH /api/documents/[id] (owner/editor only
 * — mirrored by `canRename` so viewers get a plain heading). Optimistic: the
 * heading updates immediately; on a failed PATCH it rolls back to the last
 * saved value. Enter/blur commit, Escape cancels.
 */
export function EditableTitle({
  documentId,
  initialTitle,
  canRename,
  saving = false,
}: EditableTitleProps) {
  const [title, setTitle] = useState(initialTitle);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialTitle);
  const lastSaved = useRef(initialTitle);

  async function commit() {
    const next = draft.trim();
    setEditing(false);
    if (!next || next === lastSaved.current) {
      setDraft(lastSaved.current);
      return;
    }
    const previous = lastSaved.current;
    setTitle(next); // optimistic
    lastSaved.current = next;
    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: next }),
      });
      if (!response.ok) throw new Error(`rename failed: ${response.status}`);
      document.title = `${next} — docsync`;
    } catch {
      setTitle(previous); // roll back
      setDraft(previous);
      lastSaved.current = previous;
    }
  }

  if (!canRename) {
    return (
      <h1 className="text-2xl font-semibold tracking-tight text-balance text-foreground sm:text-3xl">
        {title}
      </h1>
    );
  }

  if (editing) {
    return (
      <input
        // entered via an explicit user action (clicking the title), so focus
        // must follow the click
        autoFocus
        value={draft}
        maxLength={200}
        aria-label="Document title"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit();
          if (event.key === "Escape") {
            setDraft(lastSaved.current);
            setEditing(false);
          }
        }}
        className="w-full min-w-0 rounded-lg border border-ring/60 bg-background px-2 py-1 text-2xl font-semibold tracking-tight text-foreground outline-none ring-3 ring-ring/25 sm:text-3xl"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(title);
        setEditing(true);
      }}
      title="Rename document"
      className={cn(
        "group/title -ml-2 flex min-w-0 items-start gap-2 rounded-lg px-2 py-1 text-left transition-colors",
        "hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
      )}
    >
      <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        {title}
      </h1>
      {saving ? (
        <Loader2
          aria-hidden
          className="mt-1.5 size-3.5 shrink-0 animate-spin text-muted-foreground"
        />
      ) : (
        <Pencil
          aria-hidden
          className="mt-1.5 size-3.5 shrink-0 text-muted-foreground/50 opacity-0 transition-opacity group-hover/title:opacity-100 group-focus-visible/title:opacity-100 sm:opacity-0"
        />
      )}
      <span className="sr-only">— rename document</span>
    </button>
  );
}
