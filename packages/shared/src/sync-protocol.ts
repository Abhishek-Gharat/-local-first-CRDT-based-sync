import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import type * as Y from "yjs";
import type { Awareness } from "y-protocols/awareness";

/**
 * Wire format: every message is a leading varUint message-type byte followed
 * by a type-specific payload. Mirrors the format y-websocket itself uses, so
 * a real browser WebSocket client and a plain Node `ws` server agree on
 * bytes without either depending on y-websocket as a package.
 */
export const MESSAGE_SYNC = 0;
export const MESSAGE_AWARENESS = 1;

export interface SyncContext {
  doc: Y.Doc;
  awareness: Awareness;
}

/** First message a side sends: "here's my state vector, tell me what I'm missing." */
export function encodeSyncStep1(doc: Y.Doc): Uint8Array {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MESSAGE_SYNC);
  syncProtocol.writeSyncStep1(encoder, doc);
  return encoding.toUint8Array(encoder);
}

/** Wraps a raw Yjs update (e.g. from `doc.on('update', ...)`) for the wire. */
export function encodeUpdate(update: Uint8Array): Uint8Array {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MESSAGE_SYNC);
  syncProtocol.writeUpdate(encoder, update);
  return encoding.toUint8Array(encoder);
}

export function encodeAwarenessUpdate(
  awareness: Awareness,
  changedClients: number[],
): Uint8Array {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
  encoding.writeVarUint8Array(
    encoder,
    awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients),
  );
  return encoding.toUint8Array(encoder);
}

/**
 * Applies one incoming protocol message to `doc`/`awareness`. Returns a
 * reply to send straight back to the sender (SyncStep2 in response to a
 * SyncStep1 handshake), or null when there's nothing to send back.
 *
 * `origin` is attached to the Yjs transaction that applies the update, so
 * callers can tell "did I just apply something remote?" apart from
 * genuinely-local edits inside their own `doc.on('update', ...)` listener.
 */
export function applyIncomingMessage(
  message: Uint8Array,
  { doc, awareness }: SyncContext,
  origin: unknown,
): Uint8Array | null {
  const decoder = decoding.createDecoder(message);
  const messageType = decoding.readVarUint(decoder);

  switch (messageType) {
    case MESSAGE_SYNC: {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_SYNC);
      syncProtocol.readSyncMessage(decoder, encoder, doc, origin);
      // readSyncMessage only writes a payload past the header byte when it
      // just processed a SyncStep1 (replying with SyncStep2); SyncStep2 and
      // Update messages leave the encoder at length 1, so there's no reply.
      return encoding.length(encoder) > 1 ? encoding.toUint8Array(encoder) : null;
    }
    case MESSAGE_AWARENESS: {
      awarenessProtocol.applyAwarenessUpdate(
        awareness,
        decoding.readVarUint8Array(decoder),
        origin,
      );
      return null;
    }
    default:
      return null;
  }
}
