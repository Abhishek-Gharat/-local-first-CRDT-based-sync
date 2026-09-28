"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, FileText, Loader2, PenLine, TriangleAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

const BLANK = "Untitled document";

/**
 * Create-document flow.
 *
 * Opens with the title pre-selected so the fastest possible path is
 * type-title → Enter. The "start blank vs. named" choice is a two-option
 * segmented control rather than an empty field the user has to interpret:
 * it is the most common decision in the product and should not be inferred
 * from a placeholder.
 */
export function NewDocumentDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [mode, setMode] = useState<"blank" | "named">("named");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset the form on the open *transition* rather than in an effect: React
  // renders the new state before committing, so the dialog never paints a
  // stale title or a stale error from the previous use.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setTitle("");
      setMode("named");
      setError(null);
    }
  }

  async function handleCreate() {
    if (creating) return;
    const nextTitle = mode === "blank" ? BLANK : title.trim();
    if (mode === "named" && !nextTitle) return;

    setCreating(true);
    setError(null);
    try {
      const response = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: nextTitle }),
      });
      if (!response.ok) {
        setError(
          response.status === 401
            ? "Your session expired — sign in again to create a document."
            : "Could not create the document. Try again.",
        );
        return;
      }
      const { document } = (await response.json()) as { document: { id: string } };
      onOpenChange(false);
      router.push(`/documents/${document.id}`);
    } catch {
      setError("Could not reach the server. Check your connection and retry.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" aria-label="New document">
        <DialogHeader>
          <span
            aria-hidden
            className="mb-1 flex size-9 w-fit items-center justify-center rounded-lg bg-primary/10 text-primary"
          >
            <FileText className="size-4" />
          </span>
          <DialogTitle>New document</DialogTitle>
          <DialogDescription>
            A blank CRDT document. It is written to this browser first and syncs
            as soon as you are online.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void handleCreate();
          }}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <ToggleGroup
              value={[mode]}
              onValueChange={(value) => {
                const next = value[0];
                if (next) setMode(next as "blank" | "named");
              }}
              className="w-fit"
            >
              <ToggleItem value="named">
                <PenLine aria-hidden />
                Name it now
              </ToggleItem>
              <ToggleItem value="blank">Start blank</ToggleItem>
            </ToggleGroup>

            <Input
              ref={inputRef}
              id="new-document-title"
              value={mode === "blank" ? BLANK : title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Q3 platform roadmap"
              maxLength={200}
              disabled={creating || mode === "blank"}
              aria-label="Document title"
              autoFocus
              className={cn("h-9", mode === "blank" && "opacity-60")}
            />
          </div>

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
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={creating || (mode === "named" && !title.trim())}
              className="gap-1.5 font-medium"
            >
              {creating ? (
                <>
                  <Loader2 aria-hidden className="size-3.5 animate-spin" />
                  Creating…
                </>
              ) : (
                <>
                  Create document
                  <ArrowRight aria-hidden className="size-3.5" />
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Header trigger. Kept as a separate export so the workspace header owns the
 * single "New document" affordance (and therefore the single accessible
 * name) rather than duplicating it into the sidebar.
 */
export function NewDocumentButton({
  onClick,
  className,
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <Button
      size="sm"
      onClick={onClick}
      aria-label="New document"
      className={cn("gap-1.5 font-medium shadow-xs", className)}
    >
      <PenLine aria-hidden className="size-3.5" />
      <span className="hidden sm:inline">New document</span>
      <span className="sm:hidden">New</span>
    </Button>
  );
}
