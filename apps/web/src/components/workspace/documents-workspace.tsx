"use client";

import { useCallback, useDeferredValue, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpDown,
  CircleHelp,
  FileText,
  FolderOpen,
  History,
  LayoutGrid,
  Plus,
  Rows3,
  Search,
  SearchX,
  Trash2,
  Users,
  X,
} from "lucide-react";
import type { DocumentSummary } from "@/lib/workspace/load-documents";
import {
  filterByView,
  groupByRecency,
  sortDocuments,
  type SortKey,
  type WorkspaceView,
} from "@/lib/workspace/document-buckets";
import { DocumentCard, DocumentRow } from "@/components/workspace/document-item";
import { CommandPalette } from "@/components/workspace/command-palette";
import {
  KeyboardShortcutsDialog,
  useShortcutsDialogTriggers,
} from "@/components/editor/keyboard-shortcuts-dialog";
import {
  DeleteDocumentDialog,
  type DeleteTarget,
} from "@/components/workspace/delete-document-dialog";
import {
  NewDocumentButton,
  NewDocumentDialog,
} from "@/app/(workspace)/documents/new-document-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShortcutKeys } from "@/components/ui/kbd";
import { ToggleGroup, ToggleItem } from "@/components/ui/toggle-group";
import { EmptyState } from "@/components/states/empty-state";
import { cn } from "@/lib/utils";

interface DocumentsWorkspaceProps {
  documents: DocumentSummary[];
  currentUserId: string;
  currentUserName: string;
  initialView: WorkspaceView;
}

const VIEWS: { id: WorkspaceView; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "all", label: "All", icon: FileText },
  { id: "owned", label: "Owned by me", icon: FolderOpen },
  { id: "shared", label: "Shared with me", icon: Users },
];

const SORTS: { id: SortKey; label: string }[] = [
  { id: "updated", label: "Last edited" },
  { id: "created", label: "Date created" },
  { id: "title", label: "Title" },
];

/**
 * The workspace: a control bar, a density stat strip, and documents grouped
 * into recency sections — presented either as a dense table or as cards.
 *
 * Filtering, sorting, view switching and search are all client-side over the
 * server-provided summaries, so every control responds instantly and none of
 * them costs a round trip.
 */
export function DocumentsWorkspace({
  documents,
  currentUserId,
  currentUserName,
  initialView,
}: DocumentsWorkspaceProps) {
  const router = useRouter();
  const [view, setView] = useState<WorkspaceView>(initialView);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("updated");
  const [layout, setLayout] = useState<"list" | "grid">("list");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  // Ids removed optimistically. Kept alongside the server-provided list so
  // the row disappears immediately and does not flash back if the refresh is
  // slow; once the refreshed list arrives the filter is simply a no-op.
  const [deletedIds, setDeletedIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [announcement, setAnnouncement] = useState("");
  const deferredQuery = useDeferredValue(query);

  // Only the owner sees the delete affordance, so it is only offered to them.
  const owned = useMemo(
    () => documents.filter((d) => d.ownerId === currentUserId),
    [documents, currentUserId],
  );

  const visible = useMemo(
    () => documents.filter((doc) => !deletedIds.has(doc.id)),
    [documents, deletedIds],
  );

  const handleDeleteRequest = useCallback((document: DocumentSummary) => {
    setDeleteTarget({ id: document.id, title: document.title });
  }, []);

  // Duplicating navigates to the new document, so the only thing left to do
  // here is re-pull the server in the background in case the user comes back.
  const handleDuplicated = useCallback(() => {
    router.refresh();
  }, [router]);

  const handleDeleted = useCallback(
    (target: DeleteTarget) => {
      setDeletedIds((previous) => {
        const next = new Set(previous);
        next.add(target.id);
        return next;
      });
      setAnnouncement(`Deleted “${target.title}”.`);
      // Re-pull the server so the sidebar counts (total / owned / shared /
      // versions) and the version totals in the list agree with reality.
      router.refresh();
    },
    [router],
  );

  const searched = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    if (!q) return visible;
    return visible.filter((doc) =>
      `${doc.title} ${doc.ownerName} ${doc.role}`.toLowerCase().includes(q),
    );
  }, [visible, deferredQuery]);

  const scoped = useMemo(
    () => filterByView(searched, view, currentUserId),
    [searched, view, currentUserId],
  );
  const ordered = useMemo(() => sortDocuments(scoped, sort), [scoped, sort]);
  const buckets = useMemo(() => groupByRecency(ordered), [ordered]);

  const stats = useMemo(() => {
    const versions = documents.reduce((sum, d) => sum + d.versionCount, 0);
    const collaborators = documents.reduce(
      (sum, d) => sum + Math.max(d.memberCount - 1, 0),
      0,
    );
    return {
      owned: owned.length,
      shared: documents.length - owned.length,
      versions,
      collaborators,
    };
  }, [documents, owned]);

  const isFiltered = query.trim() !== "" || view !== "all";
  // The workspace is "empty" only if the server has nothing; a deletion that
  // empties the list should land in the no-matches state, not re-prompt the
  // user to create their first document.
  const hasDocuments = documents.length > 0;
  const canDelete = owned.length > 0;

  const toggleShortcuts = useCallback(
    () => setShortcutsOpen((open) => !open),
    [],
  );
  useShortcutsDialogTriggers(toggleShortcuts);

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      {/* ── Workspace header ─────────────────────────────────────────── */}
      <header className="border-b border-border bg-background/70 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 pt-5 pb-4 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight text-foreground">
                Documents
              </h1>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {hasDocuments
                  ? `${visible.length} document${visible.length === 1 ? "" : "s"} · ${
                      stats.versions
                    } saved version${stats.versions === 1 ? "" : "s"}`
                  : "Nothing here yet"}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                className={cn(
                  "group hidden h-8 w-52 items-center gap-2 rounded-lg border border-input bg-background px-2.5 text-left text-xs text-muted-foreground transition-colors",
                  "hover:border-border-strong hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:flex",
                )}
              >
                <Search aria-hidden className="size-3.5 shrink-0" />
                <span className="min-w-0 flex-1 truncate">Search documents</span>
                <ShortcutKeys keys={["⌘", "K"]} />
              </button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPaletteOpen(true)}
                aria-label="Search documents"
                className="sm:hidden"
              >
                <Search aria-hidden className="size-3.5" />
              </Button>
              <NewDocumentButton onClick={() => setCreateOpen(true)} />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShortcutsOpen(true)}
                aria-label="Keyboard shortcuts"
                className="px-2 text-muted-foreground"
              >
                <CircleHelp aria-hidden className="size-4" />
              </Button>
            </div>
          </div>

          {/* ── Control bar: view · search · sort · layout ───────────── */}
          <div className="flex flex-wrap items-center gap-2">
            <ToggleGroup
              value={[view]}
              onValueChange={(value) => {
                const next = value[0];
                if (next) setView(next as WorkspaceView);
              }}
              aria-label="Filter documents by access"
            >
              {VIEWS.map((item) => (
                <ToggleItem key={item.id} value={item.id} aria-label={item.label}>
                  <item.icon />
                  <span className="hidden sm:inline">{item.label}</span>
                </ToggleItem>
              ))}
            </ToggleGroup>

            <div className="relative min-w-0 flex-1 sm:max-w-64">
              <Search
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Filter by title or owner…"
                aria-label="Filter documents"
                className="h-8 pl-8 pr-7 text-xs"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear filter"
                  className="absolute top-1/2 right-1.5 inline-flex size-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X aria-hidden className="size-3" />
                </button>
              )}
            </div>

            <label className="relative">
              <span className="sr-only">Sort documents</span>
              <ArrowUpDown
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-2.5 size-3 -translate-y-1/2 text-muted-foreground"
              />
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as SortKey)}
                className="h-8 appearance-none rounded-lg border border-input bg-background pr-7 pl-7 text-xs font-medium text-foreground outline-none transition-colors hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
              >
                {SORTS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <ToggleGroup
              value={[layout]}
              onValueChange={(value) => {
                const next = value[0];
                if (next) setLayout(next as "list" | "grid");
              }}
              aria-label="Layout"
              className="ml-auto"
            >
              <ToggleItem value="list" aria-label="List view">
                <Rows3 />
              </ToggleItem>
              <ToggleItem value="grid" aria-label="Grid view">
                <LayoutGrid />
              </ToggleItem>
            </ToggleGroup>
          </div>

          {/* ── Density stat strip ───────────────────────────────────── */}
          {hasDocuments && (
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-4">
              <StatTile
                icon={FileText}
                label="Total"
                value={visible.length}
                active={view === "all"}
                onClick={() => setView("all")}
              />
              <StatTile
                icon={FolderOpen}
                label="Owned"
                value={stats.owned}
                active={view === "owned"}
                onClick={() => setView("owned")}
              />
              <StatTile
                icon={Users}
                label="Shared"
                value={stats.shared}
                active={view === "shared"}
                onClick={() => setView("shared")}
              />
              <StatTile
                icon={History}
                label="Versions"
                value={stats.versions}
              />
            </dl>
          )}
        </div>
      </header>

      {/* ── Content ──────────────────────────────────────────────────── */}
      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-5 sm:px-6">
        {!hasDocuments ? (
          <EmptyState
            icon={FileText}
            title="No documents yet"
            description="A document is created on this device first, then synced — so you can start writing before the network is even reachable."
            steps={[
              {
                label: "Create your first document",
                hint: "Give it a name; you can rename it any time later.",
              },
              {
                label: "Keep writing offline",
                hint: "Edits are committed to IndexedDB and flush on reconnect.",
              },
              {
                label: "Invite a collaborator",
                hint: "Share it as an editor or a read-only viewer.",
              },
            ]}
            actions={[
              {
                label: "Create a document",
                icon: Plus,
                onClick: () => setCreateOpen(true),
              },
              { label: "Open command palette", icon: Search, onClick: () => setPaletteOpen(true) },
            ]}
            variant="page"
            className="h-full"
          />
        ) : ordered.length === 0 ? (
          <EmptyState
            icon={visible.length === 0 ? Trash2 : SearchX}
            title={
              visible.length === 0
                ? "Workspace is empty"
                : isFiltered
                  ? "Nothing matches those filters"
                  : "Nothing here"
            }
            description={
              visible.length === 0
                ? "Every document you could see has been deleted. This cannot be undone, but you can always start a fresh one."
                : isFiltered
                  ? "No document in this view matches your search. Try a different term, or switch back to All documents."
                  : `You have no documents in this view yet, ${currentUserName.split(" ")[0]}.`
            }
            actions={
              visible.length === 0
                ? [
                    {
                      label: "Create a document",
                      icon: Plus,
                      onClick: () => setCreateOpen(true),
                    },
                  ]
                : [
                    {
                      label: "Clear filters",
                      icon: X,
                      onClick: () => {
                        setQuery("");
                        setView("all");
                      },
                    },
                    {
                      label: "Create a document",
                      icon: Plus,
                      onClick: () => setCreateOpen(true),
                    },
                  ]
            }
            variant="page"
          />
        ) : layout === "grid" ? (
          <div className="flex flex-col gap-7">
            {buckets.map((bucket) => (
              <section key={bucket.id} aria-labelledby={`bucket-${bucket.id}`}>
                <BucketHeading
                  id={`bucket-${bucket.id}`}
                  label={bucket.label}
                  hint={bucket.hint}
                  count={bucket.documents.length}
                />
                <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {bucket.documents.map((doc) => (
                    <DocumentCard
                      key={doc.id}
                      document={doc}
                      isOwner={doc.ownerId === currentUserId}
                      onDeleteRequest={canDelete ? handleDeleteRequest : undefined}
                      onDuplicateRequest={handleDuplicated}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-7">
            {buckets.map((bucket) => (
              <section key={bucket.id} aria-labelledby={`bucket-${bucket.id}`}>
                <BucketHeading
                  id={`bucket-${bucket.id}`}
                  label={bucket.label}
                  hint={bucket.hint}
                  count={bucket.documents.length}
                />
                <ul className="rounded-xl border border-border bg-card p-1">
                  {bucket.documents.map((doc) => (
                    <DocumentRow
                      key={doc.id}
                      document={doc}
                      isOwner={doc.ownerId === currentUserId}
                      onDeleteRequest={canDelete ? handleDeleteRequest : undefined}
                      onDuplicateRequest={handleDuplicated}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>

      {/* Deletion feedback. The row disappears from the list, but a silent
          removal would leave a screen-reader user with no idea why — and a
          sighted one with no confirmation that the action landed. */}
      <p aria-live="polite" role="status" className="sr-only">
        {announcement}
      </p>

      {/* Rendered at the workspace root, not inside a row's menu, so the modal
          is never a descendant of another popup's focus scope. */}
      <DeleteDocumentDialog
        target={deleteTarget}
        onOpenChange={(next) => {
          if (!next) setDeleteTarget(null);
        }}
        onDeleted={handleDeleted}
      />

      <CommandPalette
        documents={documents}
        onCreateDocument={() => setCreateOpen(true)}
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
      />
      <NewDocumentDialog open={createOpen} onOpenChange={setCreateOpen} />
      <KeyboardShortcutsDialog
        open={shortcutsOpen}
        onOpenChange={setShortcutsOpen}
        scope="workspace"
      />
    </div>
  );
}

function BucketHeading({
  id,
  label,
  hint,
  count,
}: {
  id: string;
  label: string;
  hint: string;
  count: number;
}) {
  return (
    <div className="mb-2.5 flex items-baseline gap-2.5 px-1">
      <h2
        id={id}
        className="text-[11px] font-semibold tracking-wide text-foreground uppercase"
      >
        {label}
      </h2>
      <span className="text-[11px] text-muted-foreground/70">{hint}</span>
      <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
        {count}
      </span>
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  active,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  active?: boolean;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
        <Icon
          className={cn("size-3", active && "text-primary")}
        />
        {label}
      </span>
      <span className="mt-1 block text-lg leading-none font-semibold text-foreground tabular-nums">
        {value}
      </span>
    </>
  );

  if (!onClick) {
    return (
      <div className="bg-card px-3.5 py-2.5">
        <dt className="sr-only">{label}</dt>
        <dd>{content}</dd>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "bg-card px-3.5 py-2.5 text-left transition-colors focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50 focus-visible:outline-none",
        active ? "bg-accent" : "hover:bg-muted/60",
      )}
    >
      <dt className="sr-only">{label}</dt>
      <dd>{content}</dd>
    </button>
  )
}
