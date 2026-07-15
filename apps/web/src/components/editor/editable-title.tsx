"use client";

import { useRef, useState } from "react";
import { Pencil } from "lucide-react";

interface EditableTitleProps {
  documentId: string;
  initialTitle: string;
  /** viewers see a static heading */
  canRename: boolean;
}

/**
 * Click-to-edit document title over the existing PATCH /api/documents/[id]
 * (owner/editor only — mirrored by `canRename` so viewers get a plain
 * heading). Optimistic: the heading updates immediately; on a failed PATCH
 * it rolls back to the last saved value. Enter/blur commit, Escape cancels.
 */
export function EditableTitle({ documentId, initialTitle, canRename }: EditableTitleProps) {
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
      <h1 className="truncate text-lg font-semibold tracking-tight sm:text-xl">{title}</h1>
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
        className="w-full min-w-0 max-w-md rounded-md border border-input bg-transparent px-2 py-0.5 text-lg font-semibold tracking-tight outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:text-xl"
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
      className="group/title flex min-w-0 items-center gap-2 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <h1 className="truncate text-lg font-semibold tracking-tight sm:text-xl">{title}</h1>
      <Pencil
        aria-hidden
        className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/title:opacity-100 group-focus-visible/title:opacity-100"
      />
      <span className="sr-only">— rename document</span>
    </button>
  );
}
