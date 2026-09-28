"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { CopyCheck, Loader2, TriangleAlert } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
  DuplicateError,
  createDocumentCopy,
  readCachedDocumentUpdate,
  seedDocumentContent,
} from "@/lib/documents/duplicate";

interface DuplicateDocumentMenuItemProps {
  documentId: string;
  documentTitle: string;
  /**
   * Source CRDT state to copy into the new document.
   *
   * - **omitted** — read whatever this device has cached for the source
   *   document. Free, because docsync is local-first, and it means a copy
   *   made from the dashboard carries the content whenever the document has
   *   been opened here before.
   * - a `Uint8Array` — copy exactly this state. The editor passes its live
   *   document, so the copy matches what is on screen including edits that
   *   have not synced yet.
   * - `null` — create an empty copy, no content read at all.
   */
  sourceUpdate?: Uint8Array | null;
  /** Called after the document row exists, before navigation. */
  onDuplicated?: (created: { id: string; title: string }) => void;
}

/**
 * "Make a copy" as a first-class document action.
 *
 * Available to every role, including viewers: a viewer duplicating a shared
 * document gets their own new document that they own, which grants nothing on
 * the original. That is the point of the action rather than a loophole.
 *
 * Feedback is rendered in-place and the menu is kept open, so the wait and any
 * failure are visible. On success the user is taken to the new document — the
 * destination is the confirmation, so no toast is needed.
 */
export function DuplicateDocumentMenuItem({
  documentId,
  documentTitle,
  sourceUpdate,
  onDuplicated,
}: DuplicateDocumentMenuItemProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const handleClick = useCallback(async () => {
    if (pending) return;
    setPending(true);
    setError(null);

    try {
      // Resolved before the network call so the copy is seeded from the
      // content as it is right now, not as it was a moment later.
      const update =
        sourceUpdate === undefined
          ? await readCachedDocumentUpdate(documentId)
          : sourceUpdate;

      const created = await createDocumentCopy({ title: documentTitle });

      if (update) {
        // A failed push is not fatal: the state is already in this device's
        // IndexedDB for the new document, so the copy opens correctly even
        // when the server is unreachable.
        await seedDocumentContent({
          documentId: created.id,
          update,
        });
      }

      onDuplicated?.(created);
      setAnnouncement(
        update
          ? `Created “${created.title}” with a copy of the content.`
          : `Created “${created.title}”.`,
      );
      setPending(false);
      router.push(`/documents/${created.id}`);
    } catch (cause) {
      setPending(false);
      setError(
        cause instanceof DuplicateError
          ? cause.message
          : "Could not make a copy. Try again.",
      );
      setAnnouncement("Could not make a copy.");
    }
  }, [pending, documentId, documentTitle, sourceUpdate, onDuplicated, router]);

  return (
    <>
      <DropdownMenuItem
        onClick={() => void handleClick()}
        closeOnClick={false}
        disabled={pending}
        className="justify-between gap-4"
      >
        <span className="flex items-center gap-1.5">
          {pending ? (
            <Loader2 aria-hidden className="size-3.5 animate-spin" />
          ) : error ? (
            <TriangleAlert aria-hidden className="size-3.5" />
          ) : (
            <CopyCheck aria-hidden className="size-3.5" />
          )}
          {pending ? "Duplicating…" : "Make a copy"}
        </span>
        {!pending && !error && (
          <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
            new
          </span>
        )}
      </DropdownMenuItem>

      {error && (
        <p
          role="alert"
          className="px-2 py-1.5 text-[11px] leading-snug text-destructive"
        >
          {error}
        </p>
      )}

      {/* Screen readers get the outcome; the spinner alone is visual. */}
      <span aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </>
  );
}
