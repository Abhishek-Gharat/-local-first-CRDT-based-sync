"use client";

import Link from "next/link";
import { Check, Copy, FileText, History, Users } from "lucide-react";
import type { DocumentSummary } from "@/lib/workspace/load-documents";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { Button } from "@/components/ui/button";
import { TooltipButton } from "@/components/ui/tooltip-button";
import { StatusDot } from "@/components/ui/status-dot";
import { DuplicateDocumentMenuItem } from "@/components/workspace/duplicate-document-menu-item";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { MoreHorizontal, Trash2 } from "lucide-react";

/** Role → visual token. One mapping, used by the list, grid, app bar and share panel. */
export const ROLE_TONE: Record<
  DocumentSummary["role"],
  { label: string; className: string }
> = {
  owner: {
    label: "Owner",
    className: "bg-primary/10 text-primary ring-primary/20",
  },
  editor: {
    label: "Can edit",
    className: "bg-info/10 text-info ring-info/20",
  },
  viewer: {
    label: "View only",
    className: "bg-muted text-muted-foreground ring-border",
  },
};

export function RolePill({ role }: { role: DocumentSummary["role"] }) {
  const tone = ROLE_TONE[role];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset",
        tone.className,
      )}
    >
      {tone.label}
    </span>
  );
}

function CopyLinkButton({ documentId }: { documentId: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <TooltipButton
      label="Copy link"
      tooltipSide="top"
      onClick={async () => {
        const url = `${window.location.origin}/documents/${documentId}`;
        try {
          await navigator.clipboard.writeText(url);
        } catch {
          /* clipboard blocked — the row itself is still a valid link */
        }
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      }}
    >
      {copied ? (
        <Check aria-hidden className="size-3.5 text-success" />
      ) : (
        <Copy aria-hidden className="size-3.5" />
      )}
    </TooltipButton>
  );
}

/**
 * Per-document overflow menu.
 *
 * Only owners see the destructive entry — the server re-checks the role on
 * `DELETE /api/documents/[id]`, so hiding it is a usability affordance rather
 * than the security boundary. The dialog itself is rendered by the workspace
 * (not here) so that a modal is never opened from inside a menu's focus
 * scope.
 */
function DocumentActionsMenu({
  document,
  isOwner,
  onDeleteRequest,
  onDuplicateRequest,
}: {
  document: DocumentSummary;
  isOwner: boolean;
  onDeleteRequest: (document: DocumentSummary) => void;
  onDuplicateRequest: (created: { id: string; title: string }) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={`More actions for ${document.title}`}
            className="size-6"
          />
        }
      >
        <MoreHorizontal aria-hidden className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        {/* Copying is available to every role — a viewer duplicating gets
            their own copy, which grants nothing on the original. Omitting
            `sourceUpdate` means "seed from this device's local cache". */}
        <DuplicateDocumentMenuItem
          documentId={document.id}
          documentTitle={document.title}
          onDuplicated={onDuplicateRequest}
        />

        {/* Deleting is owner-only; the route re-checks the role, so this is an
            affordance rather than the boundary. */}
        {isOwner && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => onDeleteRequest(document)}
            >
              <Trash2 aria-hidden className="size-3.5" />
              Delete document…
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Dense list row. The whole row is the link (large hit target, one tab stop)
 * while the hover-revealed actions stay independently clickable — so the
 * dense presentation never costs keyboard or pointer access.
 */
export function DocumentRow({
  document,
  isOwner,
  onDeleteRequest,
  onDuplicateRequest,
}: {
  document: DocumentSummary;
  isOwner: boolean;
  onDeleteRequest?: (document: DocumentSummary) => void;
  onDuplicateRequest?: (created: { id: string; title: string }) => void;
}) {
  return (
    <li className="group/doc relative">
      <Link
        href={`/documents/${document.id}`}
        className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
      >
        <span
          aria-hidden
          className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors group-hover/doc:border-primary/30 group-hover/doc:text-primary"
        >
          <FileText className="size-4" />
        </span>

        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-medium text-foreground">
              {document.title}
            </span>
            <RolePill role={document.role} />
          </span>
          <span className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-muted-foreground">
            {isOwner ? (
              <span>Owned by you</span>
            ) : (
              <span>Owned by {document.ownerName}</span>
            )}
            <span aria-hidden>·</span>
            <span>Updated {formatRelativeTime(new Date(document.updatedAt))}</span>
          </span>
        </span>

        {/* Metadata columns — hidden below `md` where the row only has room
            for identity, so nothing is ever truncated into illegibility. */}
        <span className="hidden w-28 shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground md:flex">
          <Users aria-hidden className="size-3 shrink-0 opacity-70" />
          <span className="tabular-nums">
            {document.memberCount === 1 ? "Just you" : `${document.memberCount} people`}
          </span>
        </span>
        <span className="hidden w-28 shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground md:flex">
          <History aria-hidden className="size-3 shrink-0 opacity-70" />
          <span className="tabular-nums">
            {document.versionCount === 0
              ? "No versions"
              : `${document.versionCount} version${document.versionCount === 1 ? "" : "s"}`}
          </span>
        </span>

        <span
          aria-hidden
          className="flex h-8 w-8 shrink-0 items-center justify-center text-muted-foreground/70 transition-colors group-hover/doc:opacity-0"
        >
          <span aria-hidden>→</span>
        </span>
      </Link>

      {/* Contextual actions, layered above the row link so they are clickable
          without stealing the row's own tap target.

          Always visible below `md`: there is no hover on touch, so an
          `opacity-0` bar would make these actions unreachable on a phone.
          From `md` up there *is* a pointer, so the bar stays out of the way
          until the row is hovered or something inside it takes focus. */}
      <div className="absolute top-1/2 right-3 flex -translate-y-1/2 items-center gap-0.5 rounded-lg border border-border bg-card p-0.5 opacity-100 shadow-sm transition-opacity duration-150 md:opacity-0 md:group-hover/doc:opacity-100 md:focus-within:opacity-100">
        <CopyLinkButton documentId={document.id} />
        <Button
          variant="ghost"
          size="icon-xs"
          nativeButton={false}
          render={
            <Link
              href={`/documents/${document.id}`}
              aria-label={`Open ${document.title}`}
              className="size-6"
            />
          }
        >
          <FileText aria-hidden className="size-3.5" />
        </Button>
        {onDeleteRequest && (
          <DocumentActionsMenu
            document={document}
            isOwner={isOwner}
            onDeleteRequest={onDeleteRequest}
            onDuplicateRequest={onDuplicateRequest ?? (() => {})}
          />
        )}
      </div>
    </li>
  );
}

/**
 * Grid variant. Same data, different job: the card leads with the title and
 * surfaces a "needs attention" line (no versions yet) instead of trying to
 * cram three columns into a narrow tile.
 */
export function DocumentCard({
  document,
  isOwner,
  onDeleteRequest,
  onDuplicateRequest,
}: {
  document: DocumentSummary;
  isOwner: boolean;
  onDeleteRequest?: (document: DocumentSummary) => void;
  onDuplicateRequest?: (created: { id: string; title: string }) => void;
}) {
  const noVersions = document.versionCount === 0;
  return (
    <li className="group/doc relative">
      <Link
        href={`/documents/${document.id}`}
        className="flex h-full flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-all duration-200 hover:border-primary/35 hover:shadow-md hover:shadow-foreground/5 focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
      >
        <div className="flex items-start justify-between gap-2">
          <span
            aria-hidden
            className="flex size-8 items-center justify-center rounded-lg bg-primary/8 text-primary"
          >
            <FileText className="size-4" />
          </span>
          <RolePill role={document.role} />
        </div>

        <div className="min-w-0">
          <h3 className="line-clamp-2 text-sm font-medium text-foreground">
            {document.title}
          </h3>
          <p className="mt-1 truncate text-[11px] text-muted-foreground">
            {isOwner ? "Owned by you" : `Owned by ${document.ownerName}`}
          </p>
        </div>

        <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-2.5">
          <span className="text-[11px] text-muted-foreground">
            Updated {formatRelativeTime(new Date(document.updatedAt))}
          </span>
          <span className="flex items-center gap-2.5 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Users aria-hidden className="size-3 opacity-70" />
              <span className="tabular-nums">{document.memberCount}</span>
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1",
                noVersions && "text-warning",
              )}
            >
              {noVersions ? (
                <StatusDot status="syncing" />
              ) : (
                <History aria-hidden className="size-3 opacity-70" />
              )}
              <span className="tabular-nums">{document.versionCount}</span>
            </span>
          </span>
        </div>
      </Link>

      {/* Always visible below `md` for the same reason as the list row: the
          card's actions must be reachable without a hover. */}
      <div className="absolute top-2.5 right-2.5 opacity-100 transition-opacity duration-150 md:opacity-0 md:group-hover/doc:opacity-100 md:focus-within:opacity-100">
        <div className="flex items-center gap-0.5 rounded-lg border border-border bg-card p-0.5 shadow-sm">
          <CopyLinkButton documentId={document.id} />
          {onDeleteRequest && (
            <DocumentActionsMenu
              document={document}
              isOwner={isOwner}
              onDeleteRequest={onDeleteRequest}
              onDuplicateRequest={onDuplicateRequest ?? (() => {})}
            />
          )}
        </div>
      </div>
    </li>
  );
}
