"use client";

import { useCallback, useEffect, useState } from "react";
import * as Y from "yjs";
import { History, Sparkles } from "lucide-react";
import { encodeSnapshot, decodeSnapshot } from "@/lib/history/codec";
import { restoreSnapshotIntoDoc } from "@/lib/history/restore";
import { Button } from "@/components/ui/button";

interface VersionSummary {
  id: string;
  authorId: string;
  label: string | null;
  createdAt: string;
}

interface ChangeSummary {
  summary: string;
  aiGenerated: boolean;
}

interface VersionHistoryProps {
  documentId: string;
  doc: Y.Doc;
  /** viewers may look at history, but not capture or restore */
  canWrite: boolean;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(`request to ${url} failed: ${response.status}`);
  return response.json() as Promise<T>;
}

export function VersionHistory({ documentId, doc, canWrite }: VersionHistoryProps) {
  const [versions, setVersions] = useState<VersionSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  // The change summary is per-version and on demand: id of the version being
  // summarized (for the spinner), plus the last result keyed by version id.
  const [summarizing, setSummarizing] = useState<string | null>(null);
  const [summaries, setSummaries] = useState<Record<string, ChangeSummary>>({});

  const loadVersions = useCallback(async () => {
    const { versions: rows } = await fetchJson<{ versions: VersionSummary[] }>(
      `/api/documents/${documentId}/versions`,
    );
    setVersions(rows);
  }, [documentId]);

  useEffect(() => {
    if (!open) return;
    // Deferred to a microtask so the eventual setVersions() call isn't a
    // synchronous cascade off this effect (react-hooks/set-state-in-effect) —
    // it runs as its own task, same as any other async-triggered update.
    void Promise.resolve().then(loadVersions);
  }, [open, loadVersions]);

  async function handleCapture() {
    setBusy(true);
    try {
      const snapshot = encodeSnapshot(Y.encodeStateAsUpdate(doc));
      await fetchJson(`/api/documents/${documentId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshot }),
      });
      await loadVersions();
    } finally {
      setBusy(false);
    }
  }

  async function handleRestore(versionId: string) {
    setBusy(true);
    try {
      const { version } = await fetchJson<{ version: { snapshot: string } }>(
        `/api/documents/${documentId}/versions/${versionId}`,
      );
      // Applies the snapshot as a diff against the live doc's current
      // content, inside a single Yjs transaction — the sync engine's
      // doc.on("update", ...) listener (sync-engine.ts) sees this exactly
      // like any other local edit and propagates it to collaborators as a
      // new forward-moving update, never a destructive overwrite of their
      // state.
      restoreSnapshotIntoDoc(doc, decodeSnapshot(version.snapshot));
    } finally {
      setBusy(false);
    }
  }

  // Summarizes what changed between a saved version and the document as it
  // stands right now. The current state is snapshotted from the live Y.Doc
  // client-side (the doc only exists in the browser) and posted alongside the
  // version id; the server diffs the two and asks the configured AI provider
  // for a plain-language summary (falling back to a word-count diff when no
  // provider is set).
  async function handleSummarize(versionId: string) {
    setSummarizing(versionId);
    try {
      const toSnapshot = encodeSnapshot(Y.encodeStateAsUpdate(doc));
      const result = await fetchJson<ChangeSummary>(
        `/api/documents/${documentId}/summary`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fromVersionId: versionId, toSnapshot }),
        },
      );
      setSummaries((prev) => ({ ...prev, [versionId]: result }));
    } finally {
      setSummarizing(null);
    }
  }

  if (!open) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        aria-expanded={false}
        aria-controls="version-history-panel"
      >
        <History aria-hidden />
        History
      </Button>
    );
  }

  return (
    <section
      id="version-history-panel"
      aria-label="Version history"
      aria-busy={busy}
      className="flex w-full flex-col gap-2 rounded-xl border border-border bg-card p-4 shadow-xs"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">Version history</h2>
        <div className="flex items-center gap-2">
          {canWrite && (
            <Button size="sm" onClick={handleCapture} disabled={busy}>
              Save version
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)} aria-expanded>
            Close
          </Button>
        </div>
      </div>
      {versions.length === 0 ? (
        <p className="text-xs text-muted-foreground">No saved versions yet.</p>
      ) : (
        // An ordered list is the correct semantics for a chronological
        // timeline (newest first, per the API's ORDER BY). Each row is fully
        // keyboard-reachable: the label text and the Restore button are both
        // in normal tab order, and the button's aria-label spells out *which*
        // version it restores, since the visible "Restore" text alone is
        // ambiguous when several rows are read in sequence.
        <ol className="flex flex-col">
          {versions.map((version) => {
            const when = new Date(version.createdAt);
            const display = version.label ?? when.toLocaleString();
            const summary = summaries[version.id];
            return (
              <li
                key={version.id}
                className="flex flex-col gap-1 border-t border-border/60 py-2 text-sm first:border-t-0"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <time dateTime={when.toISOString()} className="text-muted-foreground">
                    {display}
                  </time>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={summarizing !== null}
                      onClick={() => handleSummarize(version.id)}
                      aria-label={`Summarize changes since version from ${display}`}
                    >
                      <Sparkles aria-hidden />
                      {summarizing === version.id ? "Summarizing…" : "Summarize changes"}
                    </Button>
                    {canWrite && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => handleRestore(version.id)}
                        aria-label={`Restore version from ${display}`}
                      >
                        Restore
                      </Button>
                    )}
                  </div>
                </div>
                {summary && (
                  // The generated summary lands in a polite live region so a
                  // screen-reader user hears it once it's ready. Provenance is
                  // part of the summary text itself: the fallback path already
                  // says "AI summary unavailable" / "No textual changes", so
                  // nothing extra is appended here (a bolted-on "(no AI
                  // provider configured)" was wrong for the nothing-changed
                  // case, where the AI is deliberately never called).
                  <p
                    role="status"
                    aria-live="polite"
                    className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground"
                  >
                    {summary.summary}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
