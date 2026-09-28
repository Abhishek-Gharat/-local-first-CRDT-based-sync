"use client";

import { WifiOff } from "lucide-react";
import type { ConnectionStatus as Status } from "@/lib/sync/sync-engine";
import { ConnectionStatus } from "@/components/editor/connection-status";
import { PresenceAvatars } from "@/components/editor/presence-avatars";
import type { ActiveCollaborator } from "@/lib/collaboration/collaborator-colors";
import { cn } from "@/lib/utils";

interface EditorStatusBarProps {
  status: Status;
  collaborators: ActiveCollaborator[];
  words: number;
  chars: number;
  /** "Saved locally" / "Failed" feedback from the most recent version save. */
  saveNote: string | null;
  offline: boolean;
}

/**
 * Editor status bar.
 *
 * Anchors the bottom of the writing surface with the three things a
 * local-first editor should never make you hunt for: how much is written,
 * who else is in the doc, and whether anything is still in flight. The
 * connection chip reuses the exact same component the app bar uses, just in
 * its compact form, so "what does amber mean?" has one answer in the product.
 */
export function EditorStatusBar({
  status,
  collaborators,
  words,
  chars,
  saveNote,
  offline,
}: EditorStatusBarProps) {
  const readMinutes = Math.max(1, Math.ceil(words / 220));

  return (
    <footer className="sticky bottom-0 z-20 border-t border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-1.5 text-[11px] text-muted-foreground sm:px-6">
        <span aria-label="Document statistics" className="tabular-nums">
          {words.toLocaleString()} {words === 1 ? "word" : "words"} ·{" "}
          {chars.toLocaleString()} characters · {readMinutes} min read
        </span>

        <span aria-hidden className="hidden h-3 w-px bg-border sm:block" />

        {/* Presence is also in the app bar, but only at `md+`; on a phone the
            status bar is the one place it is always visible. */}
        <div className="md:hidden">
          <PresenceAvatars collaborators={collaborators} maxVisible={3} />
        </div>

        <div className="md:hidden">
          <ConnectionStatus status={status} variant="inline" />
        </div>

        {offline && (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2 py-0.5 font-medium",
            )}
          >
            <WifiOff aria-hidden className="size-3" />
            Saved on this device
          </span>
        )}

        {/* aria-live (not role="status") — the editor page reserves its single
            status role for the sync indicator in the app bar. */}
        {saveNote && (
          <span aria-live="polite" className="ml-auto truncate">
            {saveNote}
          </span>
        )}
      </div>
    </footer>
  );
}
