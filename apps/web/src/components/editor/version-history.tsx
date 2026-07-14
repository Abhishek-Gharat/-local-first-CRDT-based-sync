"use client";

import { useCallback, useEffect, useState } from "react";
import * as Y from "yjs";
import { encodeSnapshot, decodeSnapshot } from "@/lib/history/codec";
import { restoreSnapshotIntoDoc } from "@/lib/history/restore";
import { Button } from "@/components/ui/button";

interface VersionSummary {
  id: string;
  authorId: string;
  label: string | null;
  createdAt: string;
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

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        History
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Version history</span>
        <div className="flex items-center gap-2">
          {canWrite && (
            <Button size="sm" onClick={handleCapture} disabled={busy}>
              Save version
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Close
          </Button>
        </div>
      </div>
      {versions.length === 0 ? (
        <p className="text-xs text-muted-foreground">No saved versions yet.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {versions.map((version) => (
            <li key={version.id} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {version.label ?? new Date(version.createdAt).toLocaleString()}
              </span>
              {canWrite && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => handleRestore(version.id)}
                >
                  Restore
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
