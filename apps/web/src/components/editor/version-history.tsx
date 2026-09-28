"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import * as Y from "yjs";
import {
  Clock,
  GitCommitVertical,
  GitCompareArrows,
  History,
  Loader2,
  RotateCcw,
  Sparkles,
  TriangleAlert,
  WifiOff,
  X,
} from "lucide-react";
import { encodeSnapshot, decodeSnapshot } from "@/lib/history/codec";
import { restoreSnapshotIntoDoc } from "@/lib/history/restore";
import {
  compareSnapshotWithLive,
  decodeSnapshotToText,
  type DiffChunk,
} from "@/lib/history/version-diff";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { getCollaboratorColor, getInitials } from "@/lib/collaboration/collaborator-colors";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TooltipButton } from "@/components/ui/tooltip-button";
import { useOnline } from "@/hooks/use-online";
import { cn } from "@/lib/utils";

interface VersionSummary {
  id: string;
  authorId: string;
  label: string | null;
  createdAt: string;
}

interface ChangeSummary {
  summary: string;
  aiGenerated: boolean;
  stats?: { addedWords: number; removedWords: number };
}

interface VersionHistoryProps {
  documentId: string;
  doc: Y.Doc;
  /** viewers may look at history, but not restore */
  canWrite: boolean;
  /**
   * authorId → display name, resolved server-side. The versions API only
   * returns ids (it must not leak profiles to non-members), so the display
   * name is threaded in from the page rather than fetched again per row.
   */
  authorNames?: Record<string, string>;
  /**
   * Controlled open state. `undefined` keeps the sheet self-managing, which is
   * what the accessibility test relies on; the editor passes a value so a
   * keyboard shortcut can open it from outside.
   */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export interface VersionHistoryHandle {
  refresh: () => Promise<void>;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(`request to ${url} failed: ${response.status}`);
  return response.json() as Promise<T>;
}

/**
 * Version history as a timeline in a slide-over.
 *
 * This is one of the product's three differentiators, so it is presented as
 * one: a continuous rail of checkpoints, each carrying who saved it, when,
 * what it was called, what changed since, and what you can do about it.
 * The old popover showed a bare timestamp string per row and never displayed
 * the author at all.
 *
 * Restoring is non-destructive (it applies a forward edit to the live CRDT,
 * so collaborators converge rather than being overwritten) — the UI states
 * that explicitly before the action and after it, because "Restore" on a
 * shared document is otherwise a scary button.
 */
export const VersionHistory = forwardRef<VersionHistoryHandle, VersionHistoryProps>(
  function VersionHistory(
    {
      documentId,
      doc,
      canWrite,
      authorNames = {},
      open: controlledOpen,
      onOpenChange,
    }: VersionHistoryProps,
    ref,
  ) {
    const [versions, setVersions] = useState<VersionSummary[]>([]);
    const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState(false);
    const [restoring, setRestoring] = useState<string | null>(null);
    const [pendingRestore, setPendingRestore] = useState<VersionSummary | null>(
      null,
    );
    const [notice, setNotice] = useState<string | null>(null);
    const [summarizing, setSummarizing] = useState<string | null>(null);
    const [summaries, setSummaries] = useState<Record<string, ChangeSummary>>({});
    const [summaryErrors, setSummaryErrors] = useState<Record<string, string>>(
      {},
    );
    // Which version is being inspected in the preview/diff panel, and which
    // mode that panel is in.
    const [inspectedVersion, setInspectedVersion] = useState<VersionSummary | null>(
      null,
    );
    const [diffMode, setDiffMode] = useState<"preview" | "diff">("diff");
    const [snapshotText, setSnapshotText] = useState<string | null>(null);
    const [diffChunks, setDiffChunks] = useState<DiffChunk[] | null>(null);
    const [diffSummary, setDiffSummary] = useState<{
      addedWords: number;
      removedWords: number;
    } | null>(null);
    const [loadingSnapshot, setLoadingSnapshot] = useState(false);
    const [snapshotError, setSnapshotError] = useState(false);
    const [snapshotErrorMessage, setSnapshotErrorMessage] = useState<string | null>(null);

    const isControlled = controlledOpen !== undefined;
    const open = isControlled ? controlledOpen : uncontrolledOpen;
    const setOpen = useCallback(
      (next: boolean) => {
        if (!isControlled) setUncontrolledOpen(next);
        onOpenChange?.(next);
      },
      [isControlled, onOpenChange],
    );

    const loadVersions = useCallback(async () => {
      setLoading(true);
      setLoadError(false);
      try {
        const { versions: rows } = await fetchJson<{ versions: VersionSummary[] }>(
          `/api/documents/${documentId}/versions`,
        );
        setVersions(rows);
      } catch {
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    }, [documentId]);

    useImperativeHandle(ref, () => ({ refresh: loadVersions }));

    // Only fetch when the panel is first opened — a closed timeline should
    // cost nothing, and an open one should show its real state immediately.
    useEffect(() => {
      if (!open) return;
      void Promise.resolve().then(loadVersions);
    }, [open, loadVersions]);

    /**
     * Opens the preview/diff panel for a version.
     *
     * The snapshot is fetched here rather than at restore time because it is a
     * separate, larger payload and most versions are never inspected. The diff
     * is computed against the live document at open time, so it always reflects
     * the current state rather than whatever was on screen when the panel was
     * last used.
     */
    const inspectVersion = useCallback(
      async (version: VersionSummary) => {
        setInspectedVersion(version);
        setDiffMode("diff");
        setSnapshotText(null);
        setDiffChunks(null);
        setDiffSummary(null);
        setSnapshotError(false);
        setSnapshotErrorMessage(null);
        setLoadingSnapshot(true);
        try {
          const { version: row } = await fetchJson<{
            version: { snapshot: string };
          }>(`/api/documents/${documentId}/versions/${version.id}`);
          const snapshot = decodeSnapshot(row.snapshot);
          setSnapshotText(decodeSnapshotToText(snapshot));

          const result = compareSnapshotWithLive(snapshot, doc);
          setDiffChunks(result?.chunks ?? []);
          setDiffSummary(result?.summary ?? { addedWords: 0, removedWords: 0 });
        } catch (error) {
          setSnapshotError(true);
          setSnapshotErrorMessage(
            error instanceof Error ? error.message : "Unknown error",
          );
        } finally {
          setLoadingSnapshot(false);
        }
      },
      [documentId, doc],
    );

    const closeInspection = useCallback(() => {
      setInspectedVersion(null);
      setSnapshotText(null);
      setDiffChunks(null);
      setDiffSummary(null);
    }, []);

    async function handleRestore(version: VersionSummary) {
      setRestoring(version.id);
      setNotice(null);
      try {
        const { version: row } = await fetchJson<{ version: { snapshot: string } }>(
          `/api/documents/${documentId}/versions/${version.id}`,
        );
        restoreSnapshotIntoDoc(doc, decodeSnapshot(row.snapshot));
        setNotice(
          `Restored v${versions.length - versions.findIndex((v) => v.id === version.id)} as a new edit — collaborators will converge on it.`,
        );
        setPendingRestore(null);
      } catch {
        setNotice("Could not restore that version. Check your connection and retry.");
      } finally {
        setRestoring(null);
      }
    }

    async function handleSummarize(version: VersionSummary) {
      setSummarizing(version.id);
      setSummaryErrors((prev) => ({ ...prev, [version.id]: "" }));
      try {
        const toSnapshot = encodeSnapshot(Y.encodeStateAsUpdate(doc));
        const result = await fetchJson<ChangeSummary>(
          `/api/documents/${documentId}/summary`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fromVersionId: version.id, toSnapshot }),
          },
        );
        setSummaries((prev) => ({ ...prev, [version.id]: result }));
      } catch {
        setSummaryErrors((prev) => ({
          ...prev,
          [version.id]: "Could not compute a change summary.",
        }));
      } finally {
        setSummarizing(null);
      }
    }

    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              aria-controls="version-history-panel"
              aria-label="Version history"
              className="h-8 gap-1.5 font-medium"
            />
          }
        >
          <History aria-hidden className="size-3.5" />
          <span className="hidden lg:inline">History</span>
        </SheetTrigger>

        <SheetContent id="version-history-panel" side="right" aria-label="Version history">
          <SheetHeader>
            <span
              aria-hidden
              className="mb-1.5 flex size-8 w-fit items-center justify-center rounded-lg bg-primary/10 text-primary"
            >
              <GitCommitVertical className="size-4" />
            </span>
            <div>
              <SheetTitle>Version history</SheetTitle>
              <SheetDescription>
                {loading
                  ? "Loading checkpoints…"
                  : versions.length === 0
                    ? "No checkpoints saved yet"
                    : `${versions.length} checkpoint${versions.length === 1 ? "" : "s"} · newest first`}
              </SheetDescription>
            </div>
          </SheetHeader>

          <SheetBody className="px-5 py-4">
            {inspectedVersion && (
              <VersionDiffPanel
                version={inspectedVersion}
                mode={diffMode}
                onModeChange={setDiffMode}
                snapshotText={snapshotText}
                chunks={diffChunks}
                summary={diffSummary}
                loading={loadingSnapshot}
                error={snapshotError}
                errorMessage={snapshotErrorMessage}
                onClose={closeInspection}
              />
            )}
            {loading && versions.length === 0 ? (
              <TimelineSkeleton />
            ) : loadError ? (
              <LoadError onRetry={() => void loadVersions()} />
            ) : versions.length === 0 ? (
              <EmptyHistory canWrite={canWrite} />
            ) : (
              <ol className="relative flex flex-col" aria-label="Saved versions">
                {/* The rail: one continuous line so the list reads as a
                    timeline rather than a stack of unrelated cards. */}
                <span
                  aria-hidden
                  className="absolute top-2 bottom-2 left-[7px] w-px bg-border"
                />
                {versions.map((version, index) => {
                  const when = new Date(version.createdAt);
                  const ordinal = versions.length - index;
                  const isLatest = index === 0;
                  const summary = summaries[version.id];
                  const summaryError = summaryErrors[version.id];
                  const authorName =
                    authorNames[version.authorId] ?? "Unknown author";
                  const color = getCollaboratorColor(
                    version.authorId || authorName,
                  );

                  return (
                    <li key={version.id} className="relative pl-7">
                      {/* checkpoint node */}
                      <span
                        aria-hidden
                        className={cn(
                          "absolute top-3 left-0 flex size-3.5 items-center justify-center rounded-full ring-4 ring-popover transition-colors",
                          isLatest
                            ? "bg-primary"
                            : "border border-border-strong bg-muted-foreground/40",
                        )}
                      >
                        {isLatest && (
                          <span className="size-1.5 rounded-full bg-primary-foreground" />
                        )}
                      </span>

                      <div
                        className={cn(
                          "rounded-xl border p-3 transition-colors",
                          isLatest
                            ? "border-primary/25 bg-primary/[0.03]"
                            : "border-border bg-card hover:border-border-strong",
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span
                                className={cn(
                                  "rounded-md px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums",
                                  isLatest
                                    ? "bg-primary/12 text-primary"
                                    : "bg-muted text-muted-foreground",
                                )}
                              >
                                v{ordinal}
                              </span>
                              {isLatest && (
                                <span className="text-[10px] font-medium text-primary">
                                  Current
                                </span>
                              )}
                              <span
                                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"
                                title={when.toLocaleString()}
                              >
                                <Clock aria-hidden className="size-3" />
                                <time dateTime={when.toISOString()}>
                                  {formatRelativeTime(when)}
                                </time>
                              </span>
                            </div>
                            {version.label && (
                              <p className="mt-1.5 text-sm font-medium text-foreground">
                                {version.label}
                              </p>
                            )}
                            <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                              <span
                                aria-hidden
                                className="flex size-4 items-center justify-center rounded-full text-[8px] font-semibold text-white"
                                style={{ backgroundColor: color }}
                              >
                                {getInitials(authorName)}
                              </span>
                              {authorName}
                            </p>
                          </div>

                          <div className="flex shrink-0 items-center gap-1">
                            <TooltipButton
                              label={
                                inspectedVersion?.id === version.id
                                  ? "Close comparison"
                                  : `Compare v${ordinal} with current`
                              }
                              tooltipSide="left"
                              disabled={loadingSnapshot}
                              onClick={() => {
                                if (inspectedVersion?.id === version.id) {
                                  closeInspection();
                                } else {
                                  void inspectVersion(version);
                                }
                              }}
                            >
                              {inspectedVersion?.id === version.id ? (
                                <X aria-hidden className="size-3.5" />
                              ) : (
                                <GitCompareArrows aria-hidden className="size-3.5" />
                              )}
                            </TooltipButton>
                            <TooltipButton
                              label="Summarize changes since this version"
                              tooltipSide="left"
                              disabled={summarizing !== null}
                              onClick={() => void handleSummarize(version)}
                            >
                              {summarizing === version.id ? (
                                <Loader2
                                  aria-hidden
                                  className="size-3.5 animate-spin text-primary"
                                />
                              ) : (
                                <Sparkles aria-hidden className="size-3.5" />
                              )}
                            </TooltipButton>
                            {canWrite && (
                              <TooltipButton
                                label={`Restore v${ordinal}`}
                                tooltipSide="left"
                                disabled={restoring !== null}
                                onClick={() => setPendingRestore(version)}
                              >
                                <RotateCcw aria-hidden className="size-3.5" />
                              </TooltipButton>
                            )}
                          </div>
                        </div>

                        {/* Change statistics + summary */}
                        {summary && (
                          <div className="mt-2.5 rounded-lg border border-border bg-muted/30 p-2.5">
                            <div className="mb-1.5 flex flex-wrap items-center gap-2">
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium",
                                  summary.aiGenerated
                                    ? "bg-primary/10 text-primary"
                                    : "bg-muted text-muted-foreground",
                                )}
                              >
                                <Sparkles aria-hidden className="size-2.5" />
                                {summary.aiGenerated
                                  ? "AI summary"
                                  : "Word-count summary"}
                              </span>
                              {summary.stats && (
                                <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                                  <span className="text-success">
                                    +{summary.stats.addedWords}
                                  </span>{" "}
                                  /{" "}
                                  <span className="text-destructive">
                                    −{summary.stats.removedWords}
                                  </span>{" "}
                                  words
                                </span>
                              )}
                            </div>
                            <p className="text-xs leading-relaxed text-foreground/90">
                              {summary.summary}
                            </p>
                            {!summary.aiGenerated && (
                              <p className="mt-1.5 text-[10px] leading-snug text-muted-foreground/80">
                                No AI provider is configured, so this is the
                                deterministic word-count summary. Set
                                AI_PROVIDER and a matching API key to get a
                                written summary.
                              </p>
                            )}
                          </div>
                        )}

                        {summaryError && (
                          <p
                            role="status"
                            aria-live="polite"
                            className="mt-2 flex items-center gap-1.5 text-[11px] text-destructive"
                          >
                            <TriangleAlert aria-hidden className="size-3" />
                            {summaryError}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </SheetBody>

          <SheetFooter className="flex-col items-start gap-1.5">
            {/* aria-live without role="status": the editor page reserves its
                single status role for the sync indicator. */}
            <p aria-live="polite" className="text-[11px] text-muted-foreground">
              {restoring
                ? "Applying the checkpoint as a new edit…"
                : (notice ??
                  "Restoring applies a new edit instead of rewriting history — nobody's work is overwritten.")}
            </p>
          </SheetFooter>

          {/* Restore confirmation. Restoring is a forward edit rather than a
              rollback, but it still changes everyone's document, so it is
              confirmed explicitly. */}
          <Dialog
            open={pendingRestore !== null}
            onOpenChange={(next) => {
              if (!next) setPendingRestore(null);
            }}
          >
            <DialogContent className="max-w-sm" aria-label="Confirm restore">
              <DialogHeader>
                <span
                  aria-hidden
                  className="mb-1 flex size-9 w-fit items-center justify-center rounded-lg bg-warning/15 text-warning"
                >
                  <RotateCcw className="size-4" />
                </span>
                <DialogTitle>
                  Restore{" "}
                  {pendingRestore
                    ? `v${versions.length - versions.findIndex((v) => v.id === pendingRestore.id)}`
                    : "this version"}
                  ?
                </DialogTitle>
                <DialogDescription>
                  This applies the saved checkpoint as a new edit. Nothing is
                  deleted — current content stays in history, and anyone
                  editing with you converges on the restored state.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setPendingRestore(null)}
                  disabled={restoring !== null}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (pendingRestore) void handleRestore(pendingRestore);
                  }}
                  disabled={restoring !== null}
                  className="gap-1.5 font-medium"
                >
                  {restoring ? (
                    <>
                      <Loader2 aria-hidden className="size-3.5 animate-spin" />
                      Restoring…
                    </>
                  ) : (
                    <>
                      <RotateCcw aria-hidden className="size-3.5" />
                      Restore version
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </SheetContent>
      </Sheet>
    );
  },
);

function TimelineSkeleton() {
  return (
    <div className="flex flex-col gap-3" role="status" aria-live="polite">
      <span className="sr-only">Loading version history</span>
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="flex gap-3">
          <Skeleton className="mt-1 size-3.5 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2 rounded-xl border border-border p-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-10 rounded-md" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-2.5 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

function LoadError({ onRetry }: { onRetry: () => void }) {
  const offline = !useOnline();
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-xl border border-destructive/25 bg-destructive/5 px-5 py-8 text-center"
    >
      <span
        aria-hidden
        className="flex size-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive"
      >
        {offline ? (
          <WifiOff className="size-4" />
        ) : (
          <TriangleAlert className="size-4" />
        )}
      </span>
      <div>
        <p className="text-sm font-semibold text-foreground">
          {offline ? "You are offline" : "Could not load history"}
        </p>
        <p className="mt-1 max-w-xs text-xs text-muted-foreground">
          {offline
            ? "Version history lives on the server. Reconnect and try again — the document itself is still editable locally."
            : "The history request failed. Retrying usually clears it."}
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry} className="font-medium">
        Retry
      </Button>
    </div>
  );
}

/**
 * Preview / diff panel for one version.
 *
 * Two modes, because they answer different questions. "Snapshot" shows what the
 * document said at that checkpoint — useful for reading. "Changes" shows what
 * differs from the live document — useful for deciding whether to restore.
 * The diff is computed against the *current* document, so it is a live answer,
 * not a cached one.
 */
function VersionDiffPanel({
  version,
  mode,
  onModeChange,
  snapshotText,
  chunks,
  summary,
  loading,
  error,
  errorMessage,
  onClose,
}: {
  version: VersionSummary;
  mode: "preview" | "diff";
  onModeChange: (mode: "preview" | "diff") => void;
  snapshotText: string | null;
  chunks: DiffChunk[] | null;
  summary: { addedWords: number; removedWords: number } | null;
  loading: boolean;
  error: boolean;
  errorMessage: string | null;
  onClose: () => void;
}) {
  const when = new Date(version.createdAt);
  const authorName = "Unknown author";

  return (
    <section
      aria-label={`Comparing version from ${formatRelativeTime(when)} with the current document`}
      className="mb-4 rounded-xl border border-border bg-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <GitCompareArrows aria-hidden className="size-4 shrink-0 text-primary" />
          <p className="truncate text-xs font-medium text-foreground">
            v{version.id.slice(0, 8)} · {formatRelativeTime(when)}
          </p>
          <span className="hidden text-[10px] text-muted-foreground sm:inline">
            by {authorName}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Segmented toggle: the two modes are mutually exclusive views of the
              same version, so a toggle communicates that better than two buttons. */}
          <div
            role="group"
            aria-label="Comparison view"
            className="flex rounded-lg border border-border bg-muted/50 p-0.5"
          >
            {(
              [
                { id: "preview", label: "Snapshot" },
                { id: "diff", label: "Changes" },
              ] as const
            ).map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={mode === option.id}
                onClick={() => onModeChange(option.id)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
                  mode === option.id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Close comparison"
            className="size-7"
          >
            <X aria-hidden className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="p-3">
        {loading ? (
          <div className="flex items-center gap-2 py-6 text-xs text-muted-foreground" role="status">
            <Loader2 aria-hidden className="size-3.5 animate-spin" />
            Loading this version…
          </div>
        ) : error ? (
          <p role="alert" className="py-4 text-center text-xs text-destructive">
            Could not load this version. {errorMessage ? `(${errorMessage})` : ""}Close and try again.
          </p>
        ) : mode === "preview" ? (
          <p className="max-h-72 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-foreground/90">
            {snapshotText}
          </p>
        ) : (
          <>
            {summary && (
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-1 font-mono text-[11px] tabular-nums">
                  <span className="font-semibold text-success">
                    +{summary.addedWords}
                  </span>
                  <span className="text-muted-foreground">words added</span>
                  <span aria-hidden className="text-border">·</span>
                  <span className="font-semibold text-destructive">
                    −{summary.removedWords}
                  </span>
                  <span className="text-muted-foreground">words removed</span>
                </span>
                <span className="text-[10px] text-muted-foreground">
                  compared with the current document
                </span>
              </div>
            )}
            <div
              // The diff is a reading surface, not a form, so it is a region
              // rather than a list of controls.
              role="region"
              aria-label="Differences from the current document"
              className="max-h-72 overflow-y-auto text-xs leading-relaxed"
            >
              {chunks && chunks.length > 0 ? (
                <p className="whitespace-pre-wrap">
                  {chunks.map((chunk, index) => {
                    if (chunk.added) {
                      return (
                        <ins
                          key={index}
                          className="rounded-sm bg-success/15 text-foreground no-underline"
                        >
                          {chunk.value}
                        </ins>
                      );
                    }
                    if (chunk.removed) {
                      return (
                        <del
                          key={index}
                          className="rounded-sm bg-destructive/15 text-muted-foreground"
                        >
                          {chunk.value}
                        </del>
                      );
                    }
                    return (
                      <span key={index} className="text-muted-foreground">
                        {chunk.value}
                      </span>
                    );
                  })}
                </p>
              ) : (
                <p className="py-4 text-center text-muted-foreground">
                  This version matches the current document.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function EmptyHistory({ canWrite }: { canWrite: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-muted/20 px-5 py-10 text-center">
      <span
        aria-hidden
        className="flex size-10 items-center justify-center rounded-xl bg-primary/8 text-primary ring-1 ring-primary/15"
      >
        <History className="size-4" />
      </span>
      <div>
        <p className="text-sm font-semibold text-foreground">No checkpoints yet</p>
        <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
          {canWrite
            ? "Use “Save version” in the top bar to pin the current state. Each checkpoint is a CRDT snapshot you can summarize and restore."
            : "The owners of this document have not saved any checkpoints yet."}
        </p>
      </div>
    </div>
  );
}
