"use client";

import { useEffect, useState } from "react";
import * as Y from "yjs";
import type { DocumentRole } from "shared";
import { IndexeddbPersistence } from "y-indexeddb";
import { createSyncEngine, type ConnectionStatus } from "@/lib/sync/sync-engine";
import { CollaborativeEditor } from "@/components/editor/collaborative-editor";
import { Badge } from "@/components/ui/badge";

interface DocumentEditorProps {
  documentId: string;
  title: string;
  role: DocumentRole;
}

const SYNC_SERVER_URL = process.env.NEXT_PUBLIC_SYNC_SERVER_URL ?? "ws://localhost:1234";

async function fetchSyncToken(documentId: string): Promise<string> {
  const response = await fetch(`/api/documents/${documentId}/sync-token`);
  if (!response.ok) throw new Error("failed to fetch sync token");
  const body = (await response.json()) as { token: string };
  return body.token;
}

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  connecting: "Connecting…",
  connected: "Connected — changes sync live",
  offline: "Offline — editing locally, will sync when reconnected",
};

// Callers must remount this component (e.g. `key={documentId}`) when
// documentId changes — the local doc is created once per mount, not
// re-derived from props, so a param change without a remount would keep
// editing the previous document's Y.Doc.
export function DocumentEditor({ documentId, title, role }: DocumentEditorProps) {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [doc] = useState(() => new Y.Doc());

  useEffect(() => {
    const persistence = new IndexeddbPersistence(`docsync:${documentId}`, doc);
    const engine = createSyncEngine({
      doc,
      url: `${SYNC_SERVER_URL}/${documentId}`,
      getToken: () => fetchSyncToken(documentId),
      onStatusChange: setStatus,
    });

    return () => {
      engine.destroy();
      persistence.destroy();
      doc.destroy();
    };
  }, [documentId, doc]);

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{role}</Badge>
          <span role="status" aria-live="polite" className="text-xs text-muted-foreground">
            {STATUS_LABEL[status]}
          </span>
        </div>
      </div>
      <div className="min-h-64 rounded-lg border border-border p-4">
        <CollaborativeEditor doc={doc} editable={role !== "viewer"} />
      </div>
    </div>
  );
}

