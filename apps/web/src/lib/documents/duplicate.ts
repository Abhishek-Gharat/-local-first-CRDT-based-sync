"use client";

import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";
import { createSyncEngine } from "@/lib/sync/sync-engine";

const COPY_PREFIX = "Copy of ";

/** The document-title limit enforced by `POST /api/documents`. */
const MAX_TITLE_LENGTH = 200;

/** A duplicate-creation failure with a message that is safe to show a user. */
export class DuplicateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DuplicateError";
  }
}

/**
 * Builds the title for a copy.
 *
 * Two details that are easy to get wrong: a prefix stacked on an already
 * copied title would produce "Copy of Copy of X" forever, and the API caps
 * titles at 200 characters, so an already-maximal title would push the
 * prefixed name over the limit and be rejected with a 400.
 */
export function duplicateTitle(title: string): string {
  const base = title.trim() || "Untitled document";
  // Strip every existing prefix so repeated duplication stays readable. The
  // trailing `\s*` matters: a title that is nothing but the prefix ("Copy of")
  // must collapse to empty and fall through to the fallback below, rather than
  // producing "Copy of Copy of".
  const stripped = base.replace(/^(?:copy of\s*)+/i, "").trim();
  return `${COPY_PREFIX}${stripped || "Untitled document"}`.slice(
    0,
    MAX_TITLE_LENGTH,
  );
}

export interface CreatedDocument {
  id: string;
  title: string;
}

export interface CreateDocumentCopyOptions {
  title: string;
  /** Injected in tests; defaults to the ambient `fetch`. */
  fetchImpl?: typeof fetch;
}

/**
 * Creates an empty document owned by the current user.
 *
 * Anyone may do this — a viewer duplicating a shared document gets their own
 * editable copy, which is the point: it never grants access to the original,
 * and the new row is created with the caller as owner.
 */
export async function createDocumentCopy({
  title,
  fetchImpl,
}: CreateDocumentCopyOptions): Promise<CreatedDocument> {
  const doFetch = fetchImpl ?? fetch;
  const copyTitle = duplicateTitle(title);

  let response: Response;
  try {
    response = await doFetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: copyTitle }),
    });
  } catch {
    throw new DuplicateError("Could not reach the server. Check your connection and retry.");
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new DuplicateError("Your session expired. Sign in again to make a copy.");
    }
    if (response.status === 400) {
      throw new DuplicateError("That title is not valid. Try renaming the document first.");
    }
    throw new DuplicateError("Could not create the copy. Try again.");
  }

  const body = (await response.json()) as { document?: CreatedDocument };
  if (!body?.document?.id) {
    throw new DuplicateError("The server did not return a document. Try again.");
  }
  return body.document;
}

/** True when a Y.Doc holds no content at all. */
function isEmptyDoc(doc: Y.Doc): boolean {
  return Y.decodeStateVector(Y.encodeStateVector(doc)).size === 0;
}

export interface ReadCachedUpdateOptions {
  /** Injected in tests. */
  persistenceFactory?: (doc: Y.Doc, key: string) => IndexeddbPersistence;
}

/**
 * Reads a document's content from this device's local store, without any
 * network access.
 *
 * This is what makes duplicating from the dashboard worthwhile: docsync is
 * local-first, so any document that has been opened here still has its CRDT
 * state in IndexedDB. Returns `null` when this device has never seen the
 * document, which the caller treats as "the copy starts empty" rather than an
 * error — the document itself was still created.
 */
export async function readCachedDocumentUpdate(
  documentId: string,
  options: ReadCachedUpdateOptions = {},
): Promise<Uint8Array | null> {
  const factory =
    options.persistenceFactory ??
    ((doc, key) => new IndexeddbPersistence(key, doc));

  const doc = new Y.Doc();
  const persistence = factory(doc, `docsync:${documentId}`);
  try {
    await persistence.whenSynced;
    if (isEmptyDoc(doc)) return null;
    return Y.encodeStateAsUpdate(doc);
  } finally {
    persistence.destroy();
    doc.destroy();
  }
}

export interface SeedDocumentContentOptions {
  documentId: string;
  /** Source CRDT state to copy into the new document. */
  update: Uint8Array;
  /** Base WebSocket origin of the sync server, e.g. `ws://localhost:1234`. */
  syncServerUrl?: string;
  /** Give up waiting for the server this long. */
  timeoutMs?: number;
  /** Injected in tests. */
  createEngine?: typeof createSyncEngine;
}

/**
 * Pushes a source document's CRDT state into a freshly created document.
 *
 * The new document has no room on the server yet, so a throwaway Y.Doc is
 * opened against it, the source state is applied, and the normal sync engine
 * pushes the resulting ops. The local IndexedDB copy is written in the same
 * step, which means the duplicated content is available on this device even
 * if the server is unreachable — the copy is never lost, only the push fails.
 *
 * Returns `true` when the state was pushed, `false` on timeout. A `false` is
 * not fatal: the document exists and its content is local, so the caller
 * should still navigate.
 */
export async function seedDocumentContent({
  documentId,
  update,
  syncServerUrl = process.env.NEXT_PUBLIC_SYNC_SERVER_URL ?? "ws://localhost:1234",
  timeoutMs = 8000,
  createEngine = createSyncEngine,
}: SeedDocumentContentOptions): Promise<boolean> {
  const doc = new Y.Doc();
  const persistence = new IndexeddbPersistence(`docsync:${documentId}`, doc);

  let engine: ReturnType<typeof createSyncEngine> | null = null;
  let announcePushed: (pushed: boolean) => void = () => {};

  const cleanup = () => {
    engine?.destroy();
    persistence.destroy();
    doc.destroy();
  };

  try {
    const pushed = new Promise<boolean>((resolve) => {
      announcePushed = resolve;
    });

    engine = createEngine({
      doc,
      url: `${syncServerUrl}/${documentId}`,
      getToken: async () => {
        const response = await fetch(`/api/documents/${documentId}/sync-token`);
        if (!response.ok) throw new Error("could not mint a sync token");
        const body = (await response.json()) as { token: string };
        return body.token;
      },
      // A shorter batch than the editor uses: this is a one-shot push, so the
      // usual 200ms would just be dead time.
      debounceMs: 50,
      onStatusChange: (status) => {
        // "online" means the socket is open with nothing pending, which is
        // exactly the condition under which the applied update has been
        // flushed and sent.
        if (status === "online") announcePushed(true);
      },
    });

    // Merge into whatever is already in the local store for this id rather
    // than racing the persistence's own load.
    await persistence.whenSynced;
    Y.applyUpdate(doc, update);

    const timedOut = new Promise<boolean>((resolve) => {
      window.setTimeout(() => resolve(false), timeoutMs);
    });

    const didPush = await Promise.race([pushed, timedOut]);

    // Let the debounced push and the IndexedDB write land before tearing the
    // connection down, so the copy is durable on this device either way.
    await new Promise((resolve) => window.setTimeout(resolve, 150));
    cleanup();
    return didPush;
  } catch {
    cleanup();
    return false;
  }
}
