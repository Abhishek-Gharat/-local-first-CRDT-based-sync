"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import * as Y from "yjs";
import type { Editor } from "@tiptap/react";
import {
  ArrowLeft,
  BookmarkPlus,
  Check,
  CircleHelp,
  Copy,
  FileText,
  MoreHorizontal,
  Info,
  Trash2,
} from "lucide-react";
import type { DocumentRole } from "shared";
import { Button } from "@/components/ui/button";
import { TooltipButton } from "@/components/ui/tooltip-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ExportMenu } from "@/components/editor/export-menu";
import { DuplicateDocumentMenuItem } from "@/components/workspace/duplicate-document-menu-item";
import { DeleteDocumentDialog } from "@/components/workspace/delete-document-dialog";
import { ConnectionStatus } from "@/components/editor/connection-status";
import { PresenceAvatars } from "@/components/editor/presence-avatars";
import { SharePanel } from "@/components/editor/share-panel";
import { VersionHistory, type VersionHistoryHandle } from "@/components/editor/version-history";
import { Wordmark } from "@/components/shell/wordmark";
import { DocumentOutline } from "@/components/editor/document-outline";
import { findShortcut, formatShortcut } from "@/lib/keyboard/shortcuts";
import { useIsMac } from "@/lib/keyboard/use-is-mac";
import { ThemeControl } from "@/components/theme/theme-toggle";
import { ROLE_TONE } from "@/components/workspace/document-item";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { cn } from "@/lib/utils";
import type { ActiveCollaborator } from "@/lib/collaboration/collaborator-colors";
import type { ConnectionStatus as Status } from "@/lib/sync/sync-engine";

interface EditorAppBarProps {
  documentId: string;
  documentTitle: string;
  doc: Y.Doc;
  role: DocumentRole;
  status: Status;
  collaborators: ActiveCollaborator[];
  currentUserId: string;
  createdAt: string;
  onSaveVersion: () => void;
  saving: boolean;
  canWrite: boolean;
  historyRef: React.RefObject<VersionHistoryHandle | null>;
  authorNames: Record<string, string>;
  /** Live Tiptap instance, used by the export actions. */
  editor: Editor | null;
  /** Open state of the version-history sheet, so a shortcut can open it. */
  historyOpen: boolean;
  onHistoryOpenChange: (open: boolean) => void;
  onShowShortcuts: () => void;
}

/**
 * The editor's application bar.
 *
 * One row, three zones: identity (back, brand, document), live state
 * (presence + sync), and actions. The action set is ordered by how often it
 * is needed and each control is present exactly once — the responsive
 * behaviour collapses labels to icons, it does not duplicate the controls,
 * which would double every tab stop and every accessible name.
 */
export function EditorAppBar({
  documentId,
  documentTitle,
  doc,
  role,
  status,
  collaborators,
  currentUserId,
  createdAt,
  onSaveVersion,
  saving,
  canWrite,
  historyRef,
  authorNames,
  editor,
  historyOpen,
  onHistoryOpenChange,
  onShowShortcuts,
}: EditorAppBarProps) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const isOwner = role === "owner";

  // The header hint must name the same key the handler listens for, so both
  // read the registry rather than hard-coding "⌘/" on a PC.
  const isMac = useIsMac();
  const shortcutsHint = formatShortcut(
    findShortcut("shortcuts")?.keys ?? null,
    isMac,
  );

  // Deleting from inside the editor has to leave the editor: the document no
  // longer exists, so the current route would only render a redirect loop or a
  // 403. The workspace list is where the user can see the new state.
  const handleDeleted = useCallback(() => {
    router.push("/documents");
    router.refresh();
  }, [router]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/documents/${documentId}`,
      );
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked — the URL bar still has the link */
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="flex h-14 items-center gap-2 px-3 sm:px-4">
        {/* ── Identity ─────────────────────────────────────────────── */}
        <TooltipButton
          label="Back to documents"
          tooltipSide="bottom"
          nativeButton={false}
          render={
            <Link
              href="/documents"
              aria-label="Back to documents"
              className="-ml-1 inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            />
          }
        >
          <ArrowLeft aria-hidden className="size-4" />
        </TooltipButton>

        <Link
          href="/documents"
          className="hidden shrink-0 rounded-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:block"
        >
          <Wordmark className="size-6.5" />
        </Link>

        <span aria-hidden className="hidden h-4 w-px shrink-0 bg-border sm:block" />

        <span
          aria-hidden
          className="hidden size-7 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground md:flex"
        >
          <FileText className="size-3.5" />
        </span>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span
            className="min-w-0 truncate text-sm font-semibold tracking-tight text-foreground sm:text-base"
            title={documentTitle}
          >
            {documentTitle}
          </span>
          <span
            className={cn(
              "hidden shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset sm:inline-flex",
              ROLE_TONE[role].className,
            )}
          >
            {ROLE_TONE[role].label}
          </span>
        </div>

        {/* ── Live state ───────────────────────────────────────────── */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
          <div className="hidden md:block">
            <PresenceAvatars collaborators={collaborators} />
          </div>
          <div className="hidden md:block">
            <ConnectionStatus status={status} />
          </div>
        </div>

        <span aria-hidden className="hidden h-4 w-px shrink-0 bg-border sm:block" />

        {/* ── Actions ──────────────────────────────────────────────── */}
        <div className="flex shrink-0 items-center gap-1.5">
          {canWrite && (
            <Button
              variant="outline"
              size="sm"
              onClick={onSaveVersion}
              disabled={saving}
              aria-label="Save version"
              className="h-8 gap-1.5 font-medium"
            >
              <BookmarkPlus aria-hidden className="size-3.5" />
              <span className="hidden lg:inline">
                {saving ? "Saving…" : "Save version"}
              </span>
            </Button>
          )}

          {/* members POST is owner-only server-side; don't render a share
              surface that could only ever 403 for editors/viewers */}
          {role === "owner" && (
            <SharePanel
              documentId={documentId}
              documentTitle={documentTitle}
              currentUserId={currentUserId}
            />
          )}

          <VersionHistory
            ref={historyRef}
            documentId={documentId}
            doc={doc}
            canWrite={canWrite}
            authorNames={authorNames}
            open={historyOpen}
            onOpenChange={onHistoryOpenChange}
          />

          {/* Overflow: secondary, non-destructive actions that do not
              deserve permanent real estate in the bar. */}
          <DocumentOutline editor={editor} />

          <TooltipButton
            label="Keyboard shortcuts"
            shortcut={shortcutsHint}
            tooltipSide="bottom"
            onClick={onShowShortcuts}
            className="size-8 text-muted-foreground"
          >
            <CircleHelp aria-hidden className="size-4" />
          </TooltipButton>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="More document actions"
                  className="size-8"
                />
              }
            >
              <MoreHorizontal aria-hidden className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              {/* Base UI requires a GroupLabel to live inside a Group; the
                  document header is therefore wrapped, not left bare. */}
              <DropdownMenuGroup>
                <DropdownMenuLabel className="flex items-start gap-2 px-2 py-2 normal-case">
                  <Info aria-hidden className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-semibold text-foreground">
                      {documentTitle}
                    </span>
                    <span className="block text-[11px] font-normal text-muted-foreground">
                      Created {formatRelativeTime(new Date(createdAt))}
                    </span>
                  </span>
                </DropdownMenuLabel>
              </DropdownMenuGroup>

              <DropdownMenuSeparator />

              <ThemeControl className="px-1.5 py-1" />

              <DropdownMenuSeparator />

              <ExportMenu documentTitle={documentTitle} editor={editor} />

              <DropdownMenuSeparator />

              <DropdownMenuItem onClick={() => void copyLink()}>
                {copied ? (
                  <Check aria-hidden className="size-3.5 text-success" />
                ) : (
                  <Copy aria-hidden className="size-3.5" />
                )}
                {copied ? "Link copied" : "Copy link"}
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              {/* Also in the header, but a menu entry keeps it reachable once
                  the app bar has collapsed to icons on a phone. */}
              <DropdownMenuItem onClick={onShowShortcuts}>
                <CircleHelp aria-hidden className="size-3.5" />
                Keyboard shortcuts
              </DropdownMenuItem>

              {/* Duplicating carries the content, so the copy is a real
                  starting point rather than an empty shell. Available to
                  every role — the new document is owned by the caller and
                  grants nothing on this one. */}
              <DuplicateDocumentMenuItem
                documentId={documentId}
                documentTitle={documentTitle}
                sourceUpdate={Y.encodeStateAsUpdate(doc)}
              />

              {/* Deletion is owner-only; `DELETE /api/documents/[id]`
                  re-checks the role, so this is an affordance rather than the
                  boundary. */}
              {isOwner && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => setDeleteOpen(true)}
                  >
                    <Trash2 aria-hidden className="size-3.5" />
                    Delete document…
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Sibling of the menu rather than a child of it, so the modal does not
          end up nested inside the menu's focus scope. */}
      <DeleteDocumentDialog
        target={deleteOpen ? { id: documentId, title: documentTitle } : null}
        onOpenChange={setDeleteOpen}
        onDeleted={handleDeleted}
      />
    </header>
  );
}
