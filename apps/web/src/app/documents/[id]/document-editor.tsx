"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import * as Y from "yjs";
import { ArrowLeft } from "lucide-react";
import type { DocumentRole } from "shared";
import { IndexeddbPersistence } from "y-indexeddb";
import { createSyncEngine, type ConnectionStatus as Status } from "@/lib/sync/sync-engine";
import { CollaborativeEditor } from "@/components/editor/collaborative-editor";
import { ConnectionStatus } from "@/components/editor/connection-status";
import { VersionHistory } from "@/components/editor/version-history";
import { SharePanel } from "@/components/editor/share-panel";
import { EditableTitle } from "@/components/editor/editable-title";
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

// Callers must remount this component (e.g. `key={documentId}`) when
// documentId changes — the local doc is created once per mount, not
// re-derived from props, so a param change without a remount would keep
// editing the previous document's Y.Doc.
export function DocumentEditor({ documentId, title, role }: DocumentEditorProps) {
  const [status, setStatus] = useState<Status>("syncing");
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
      {/* document header: breadcrumb-ish back link + title, then status +
          actions. Wraps cleanly at narrow widths instead of overflowing. */}
      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link
            href="/documents"
            className="inline-flex items-center gap-1 rounded-md py-0.5 pr-1 transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <ArrowLeft aria-hidden className="size-3.5" />
            Documents
          </Link>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <EditableTitle
              documentId={documentId}
              initialTitle={title}
              canRename={role !== "viewer"}
            />
            <Badge variant="secondary" className="capitalize">
              {role}
            </Badge>
          </div>
          <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2 sm:gap-3">
            <ConnectionStatus status={status} />
            <span aria-hidden className="hidden h-4 w-px bg-border sm:block" />
            {/* members POST is owner-only server-side; don't render a share
                surface that could only ever 403 for editors/viewers */}
            {role === "owner" && <SharePanel documentId={documentId} />}
            <VersionHistory documentId={documentId} doc={doc} canWrite={role !== "viewer"} />
          </div>
        </div>
      </header>

      <div className="flex min-h-[55vh] flex-1 flex-col rounded-xl border border-border bg-card px-4 py-5 shadow-xs sm:px-10 sm:py-8">
        <div className="mx-auto flex w-full max-w-[72ch] flex-1 flex-col">
          <CollaborativeEditor doc={doc} editable={role !== "viewer"} />
          {role === "viewer" && (
            <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
              You have view-only access — ask the owner for editor access to make changes.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
