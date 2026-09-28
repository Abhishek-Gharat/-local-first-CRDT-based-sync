"use client";

import { useCallback, useRef, useState } from "react";
import { Loader2, Trash2, TriangleAlert } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export interface DeleteTarget {
  id: string;
  title: string;
}

interface DeleteDocumentDialogProps {
  /** `null` closes the dialog. */
  target: DeleteTarget | null;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful DELETE, before any navigation. */
  onDeleted: (target: DeleteTarget) => void;
}

/**
 * Owner-only document deletion.
 *
 * Deletion is the only irreversible action in the product, so the dialog is
 * built as an `alertdialog` rather than a plain `dialog`: assistive tech
 * announces it as a confirmation, the title and description are wired to the
 * popup through Base UI's `aria-labelledby`/`aria-describedby`, and focus
 * lands on **Cancel** so a stray Enter cannot destroy anything.
 *
 * The owner check itself is not this component's job — `DELETE
 * /api/documents/[id]` re-derives the caller's role and returns 403 for
 * anyone else. Callers simply don't render the trigger for non-owners, and a
 * 403 is still surfaced honestly in case the roles disagree.
 */
export function DeleteDocumentDialog({
  target,
  onOpenChange,
  onDeleted,
}: DeleteDocumentDialogProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Guards against a late response from a dialog that has already closed.
  const requestRef = useRef(0);

  const open = target !== null;

  // Reset per-target state during render rather than in an effect: React
  // discards this render and re-runs it, so a second deletion can never flash
  // the previous one's error or a stale spinner.
  const [lastTargetId, setLastTargetId] = useState<string | null>(
    target?.id ?? null,
  );
  if ((target?.id ?? null) !== lastTargetId) {
    setLastTargetId(target?.id ?? null);
    setError(null);
    setPending(false);
  }

  const handleConfirm = useCallback(async () => {
    if (!target || pending) return;

    const requestId = ++requestRef.current;
    setPending(true);
    setError(null);

    try {
      const response = await fetch(`/api/documents/${target.id}`, {
        method: "DELETE",
      });

      // Ignore anything that comes back after the dialog was dismissed.
      if (requestId !== requestRef.current) return;

      if (response.ok) {
        setPending(false);
        onDeleted(target);
        onOpenChange(false);
        return;
      }

      if (response.status === 403) {
        setError(
          "Only the document owner can delete it. Ask the owner to remove it.",
        );
      } else if (response.status === 404) {
        setError("That document no longer exists — it may already be deleted.");
      } else if (response.status === 401) {
        setError("Your session expired. Sign in again to delete a document.");
      } else {
        setError("Could not delete the document. Try again.");
      }
    } catch {
      if (requestRef.current === requestId) {
        setError("Could not reach the server — check your connection and retry.");
      }
    } finally {
      if (requestRef.current === requestId) setPending(false);
    }
  }, [target, pending, onDeleted, onOpenChange]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // An in-flight delete must not be dismissable, or the request would
        // outlive the dialog with nowhere to report its result.
        if (pending) return;
        onOpenChange(next);
      }}
    >
      <DialogContent
        // `role` is spread after Base UI's own default, so this really does
        // produce an alertdialog rather than a dialog.
        role="alertdialog"
        className="max-w-md"
        aria-label="Delete document"
      >
        <DialogHeader>
          <span
            aria-hidden
            className="mb-1 flex size-9 w-fit items-center justify-center rounded-lg bg-destructive/10 text-destructive ring-1 ring-destructive/20"
          >
            <Trash2 className="size-4" />
          </span>
          <DialogTitle>Delete document</DialogTitle>
          <DialogDescription>
            {target
              ? `Are you sure you want to delete “${target.title}”? This will permanently delete the document, its versions, and shared access. This action cannot be undone.`
              : "Are you sure you want to delete this document?"}
          </DialogDescription>
        </DialogHeader>

        {/* Spells out the blast radius rather than repeating the sentence. */}
        <ul className="flex flex-col gap-1.5 rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-[11px] text-muted-foreground">
          {[
            "Every saved version is removed with it",
            "Collaborators lose access immediately",
            "Anyone with the link stops being able to open it",
          ].map((line) => (
            <li key={line} className="flex items-start gap-2">
              <span
                aria-hidden
                className="mt-1.5 size-1 shrink-0 rounded-full bg-destructive/60"
              />
              {line}
            </li>
          ))}
        </ul>

        {error && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          >
            <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
            {error}
          </p>
        )}

        <DialogFooter>
          <DialogClose
            render={
              <Button
                variant="outline"
                // Focus the safe action on open: a stray Enter must never be
                // the thing that destroys a document.
                autoFocus
                disabled={pending}
                className="font-medium"
              />
            }
          >
            Cancel
          </DialogClose>
          <Button
            variant="destructive"
            onClick={() => void handleConfirm()}
            disabled={pending}
            className="gap-1.5 font-medium"
          >
            {pending ? (
              <>
                <Loader2 aria-hidden className="size-3.5 animate-spin" />
                Deleting…
              </>
            ) : (
              <>
                <Trash2 aria-hidden className="size-3.5" />
                Delete
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
