"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function NewDocumentForm() {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");

  function openDialog() {
    setTitle("");
    dialogRef.current?.showModal();
    inputRef.current?.focus();
  }

  function closeDialog() {
    dialogRef.current?.close();
  }

  async function handleCreate() {
    if (!title.trim()) return;
    setCreating(true);
    try {
      const response = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() }),
      });
      if (!response.ok) return;
      const { document } = (await response.json()) as { document: { id: string } };
      closeDialog();
      router.push(`/documents/${document.id}`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <Button onClick={openDialog}>
        <Plus aria-hidden />
        New document
      </Button>
      <dialog
        ref={dialogRef}
        className="w-full max-w-sm rounded-xl border border-border/50 bg-card p-0 shadow-2xl"
        style={{ margin: "auto" }}
        onClose={() => setCreating(false)}
      >
        <div className="flex items-center gap-3 border-b border-border/50 px-5 py-4">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FileText aria-hidden className="size-4" />
          </span>
          <div className="flex min-w-0 flex-col">
            <h2 className="text-sm font-semibold">New document</h2>
            <p className="truncate text-xs text-muted-foreground">
              Give your document a name
            </p>
          </div>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleCreate();
          }}
          className="flex flex-col gap-3 p-5"
        >
          <Input
            ref={inputRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Untitled"
            maxLength={200}
            aria-label="Document title"
            autoFocus
            className="h-9"
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={closeDialog}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={creating || !title.trim()}>
              {creating ? "Creating…" : "Create document"}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
