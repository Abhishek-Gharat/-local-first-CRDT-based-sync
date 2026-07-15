"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from "react";
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
  /** viewers may look at history, but not restore */
  canWrite: boolean;
}

export interface VersionHistoryHandle {
  refresh: () => Promise<void>;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(`request to ${url} failed: ${response.status}`);
  return response.json() as Promise<T>;
}

export const VersionHistory = forwardRef<VersionHistoryHandle, VersionHistoryProps>(
  function VersionHistory({ documentId, doc, canWrite }, ref) {
    const [versions, setVersions] = useState<VersionSummary[]>([]);
    const [busy, setBusy] = useState(false);
    const [open, setOpen] = useState(false);
    const [summarizing, setSummarizing] = useState<string | null>(null);
    const [summaries, setSummaries] = useState<Record<string, ChangeSummary>>({});

    const loadVersions = useCallback(async () => {
      const { versions: rows } = await fetchJson<{ versions: VersionSummary[] }>(
        `/api/documents/${documentId}/versions`,
      );
      setVersions(rows);
    }, [documentId]);

    useImperativeHandle(ref, () => ({ refresh: loadVersions }));

    useEffect(() => {
      if (!open) return;
      void Promise.resolve().then(loadVersions);
    }, [open, loadVersions]);

    async function handleRestore(versionId: string) {
      setBusy(true);
      try {
        const { version } = await fetchJson<{ version: { snapshot: string } }>(
          `/api/documents/${documentId}/versions/${versionId}`,
        );
        restoreSnapshotIntoDoc(doc, decodeSnapshot(version.snapshot));
      } finally {
        setBusy(false);
      }
    }

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
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)} aria-expanded>
            Close
          </Button>
        </div>
        {versions.length === 0 ? (
          <p className="text-xs text-muted-foreground">No saved versions yet.</p>
        ) : (
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
  },
);
