"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";
import type { Editor } from "@tiptap/react";
import { Clock, Users } from "lucide-react";
import type { DocumentRole } from "shared";
import { IndexeddbPersistence } from "y-indexeddb";
import {
  createSyncEngine,
  type ConnectionStatus as Status,
} from "@/lib/sync/sync-engine";
import { encodeSnapshot } from "@/lib/history/codec";
import { detectMac, matchesShortcut } from "@/lib/keyboard/shortcuts";
import { formatRelativeTime } from "@/lib/format-relative-time";
import {
  getCollaboratorColor,
  type ActiveCollaborator,
} from "@/lib/collaboration/collaborator-colors";
import { queueVersion, flushVersionQueue } from "@/lib/offline/version-queue";
import { CollaborativeEditor } from "@/components/editor/collaborative-editor";
import { EditorAppBar } from "@/components/editor/editor-app-bar";
import { EditorStatusBar } from "@/components/editor/editor-status-bar";
import {
  EditorBootingState,
  NetworkBanner,
  ViewerNotice,
} from "@/components/editor/editor-notices";
import { EditableTitle } from "@/components/editor/editable-title";
import { VersionHistoryHandle } from "@/components/editor/version-history";
import {
  KeyboardShortcutsDialog,
  useShortcutsDialogTriggers,
} from "@/components/editor/keyboard-shortcuts-dialog";

interface DocumentEditorProps {
  documentId: string;
  title: string;
  role: DocumentRole;
  ownerName: string;
  createdAt: string;
  updatedAt: string;
  authorNames: Record<string, string>;
  currentUser?: {
    id: string;
    name: string;
  };
}

const SYNC_SERVER_URL =
  process.env.NEXT_PUBLIC_SYNC_SERVER_URL ?? "ws://localhost:1234";

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
export function DocumentEditor({
  documentId,
  title,
  role,
  ownerName,
  createdAt,
  updatedAt,
  authorNames,
  currentUser,
}: DocumentEditorProps) {
  const [status, setStatus] = useState<Status>("syncing");
  const [offline, setOffline] = useState(false);
  const [booting, setBooting] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveNote, setSaveNote] = useState<string | null>(null);
  const [doc] = useState(() => new Y.Doc());
  const [awareness] = useState(() => new Awareness(doc));
  const [collaborators, setCollaborators] = useState<ActiveCollaborator[]>([]);
  const [words, setWords] = useState(0);
  const [chars, setChars] = useState(0);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const historyRef = useRef<VersionHistoryHandle>(null);
  // The Tiptap instance, published by CollaborativeEditor. Held in state
  // rather than a ref because the export menu needs to know *at render time*
  // whether export is available, and reading `ref.current` during render is
  // unsafe. It is written exactly once, when the editor mounts.
  const [editor, setEditor] = useState<Editor | null>(null);

  const handleEditor = useCallback((instance: Editor | null) => {
    setEditor(instance);
  }, []);

  useEffect(() => {
    function updateCollaborators() {
      const states = awareness.getStates();
      const list: ActiveCollaborator[] = [];
      states.forEach((state, clientId) => {
        if (state.user && state.user.name) {
          list.push({
            clientId,
            user: state.user,
            isSelf: clientId === awareness.clientID,
          });
        }
      });
      setCollaborators(list);
    }

    awareness.on("change", updateCollaborators);
    updateCollaborators();

    return () => {
      awareness.off("change", updateCollaborators);
    };
  }, [awareness]);

  const handleSaveVersion = useCallback(async () => {
    setSaving(true);
    setSaveNote(null);
    try {
      const snapshot = encodeSnapshot(Y.encodeStateAsUpdate(doc));

      if (navigator.onLine) {
        const response = await fetch(`/api/documents/${documentId}/versions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ snapshot }),
        });
        if (!response.ok) throw new Error(`save failed: ${response.status}`);
        await historyRef.current?.refresh();
        setSaveNote("Version saved to the server");
      } else {
        await queueVersion(documentId, snapshot);
        setSaveNote("Saved locally — will sync when back online.");
      }
    } catch {
      setSaveNote("Failed to save version. Try again.");
    } finally {
      setSaving(false);
    }
  }, [doc, documentId]);

  // Network state, kept in the React tree so the banner and the status bar
  // agree with the sync engine instead of each polling navigator.onLine.
  useEffect(() => {
    const sync = () => setOffline(!window.navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  // Flush queued versions when coming back online
  useEffect(() => {
    function onOnline() {
      flushVersionQueue(documentId).then(() => {
        historyRef.current?.refresh();
        setSaveNote(null);
      });
    }
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [documentId]);

  useEffect(() => {
    if (currentUser) {
      const color = getCollaboratorColor(currentUser.id || currentUser.name);
      awareness.setLocalStateField("user", {
        id: currentUser.id,
        name: currentUser.name,
        color,
      });
    }

    const persistence = new IndexeddbPersistence(`docsync:${documentId}`, doc);
    const engine = createSyncEngine({
      doc,
      awareness,
      url: `${SYNC_SERVER_URL}/${documentId}`,
      getToken: () => fetchSyncToken(documentId),
      onStatusChange: (next) => {
        setStatus(next);
        // The editor is "booting" until the first status report lands, so we
        // never flash "connected" for a document that is still loading.
        if (next !== "syncing") setBooting(false);
      },
    });

    return () => {
      engine.destroy();
      persistence.destroy();
    };
  }, [documentId, doc, awareness, currentUser]);

  // `?` and ⌘/ open the shortcut reference. `?` deliberately does not fire
  // while the user is typing in the editor canvas, where it is a literal
  // character; the app-bar button covers that case.
  useShortcutsDialogTriggers(
    useCallback(() => setShortcutsOpen((value) => !value), []),
  );

  // Document-level shortcuts that act on the app rather than on the text, so
  // they cannot live in the editor's ProseMirror keymap.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const isMac = detectMac();
      const snapshot = {
        key: event.key,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
      };

      if (matchesShortcut(snapshot, ["mod", "s"], isMac)) {
        // The browser opens its own Save dialog on ⌘S; claiming it is what
        // makes the app's checkpoint feel native.
        event.preventDefault();
        if (role !== "viewer") void handleSaveVersion();
        return;
      }

      if (matchesShortcut(snapshot, ["mod", "shift", "h"], isMac)) {
        event.preventDefault();
        setHistoryOpen((value) => !value);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleSaveVersion, role]);

  const handleStats = useCallback((next: { words: number; chars: number }) => {
    setWords(next.words);
    setChars(next.chars);
  }, []);

  const canWrite = role !== "viewer";

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-background">
      <EditorAppBar
        documentId={documentId}
        documentTitle={title}
        doc={doc}
        role={role}
        status={status}
        collaborators={collaborators}
        currentUserId={currentUser?.id ?? ""}
        createdAt={createdAt}
        onSaveVersion={handleSaveVersion}
        saving={saving}
        canWrite={canWrite}
        historyRef={historyRef}
        authorNames={authorNames}
        editor={editor}
        historyOpen={historyOpen}
        onHistoryOpenChange={setHistoryOpen}
        onShowShortcuts={() => setShortcutsOpen(true)}
      />

      <KeyboardShortcutsDialog
        open={shortcutsOpen}
        onOpenChange={setShortcutsOpen}
        scope="editor"
      />

      <EditorBootingState visible={booting} />
      <NetworkBanner status={status} offline={offline} />

      {/* ── Writing canvas ────────────────────────────────────────────
          A single measured column of "paper" on a recessed surface. The
          document identity, its metadata rail and the editing surface live
          in one centred column, so the eye has one column to track instead
          of a bordered card floating inside a bordered page. */}
      <div className="flex-1 bg-muted/25">
        <div className="mx-auto w-full max-w-4xl px-3 py-5 sm:px-6 sm:py-8">
          <div className="rounded-2xl border border-border bg-canvas px-4 py-6 shadow-sm sm:px-10 sm:py-9">
            {/* Document identity */}
            <div className="border-b border-border pb-4">
              <EditableTitle
                documentId={documentId}
                initialTitle={title}
                canRename={canWrite}
                saving={saving}
              />

              <dl className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
                <div className="inline-flex items-center gap-1.5">
                  <Users aria-hidden className="size-3" />
                  <dt className="sr-only">Owner</dt>
                  <dd>
                    {role === "owner"
                      ? "You own this document"
                      : `Owned by ${ownerName}`}
                  </dd>
                </div>
                <span aria-hidden className="h-3 w-px bg-border" />
                <div className="inline-flex items-center gap-1.5">
                  <Clock aria-hidden className="size-3" />
                  <dt className="sr-only">Last edited</dt>
                  <dd>Edited {formatRelativeTime(new Date(updatedAt))}</dd>
                </div>
              </dl>
            </div>

            {/* Editing surface */}
            <CollaborativeEditor
              doc={doc}
              awareness={awareness}
              editable={canWrite}
              onStats={handleStats}
              onEditor={handleEditor}
            />

            {role === "viewer" && <ViewerNotice className="mt-6" />}
          </div>
        </div>
      </div>

      <EditorStatusBar
        status={status}
        collaborators={collaborators}
        words={words}
        chars={chars}
        saveNote={saveNote}
        offline={offline}
      />
    </div>
  );
}
