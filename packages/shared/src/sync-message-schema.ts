import * as decoding from "lib0/decoding";
import { z } from "zod";
import { MESSAGE_SYNC, MESSAGE_AWARENESS } from "./sync-protocol.js";

// Real Yjs updates for a text document are KBs; this caps a single wire
// frame far above any realistic edit while still bounding the worst case —
// an attacker-supplied frame is rejected by size before any decode attempt
// touches its content, so a malformed/oversized payload can't spike memory
// or CPU trying to parse it.
export const MAX_MESSAGE_BYTES = 1 * 1024 * 1024;

// SyncStep1 (0) and SyncStep2 (1) are the sync-protocol handshake exchange;
// Update (2) is a live edit. Mirrors y-protocols' messageYjsSyncStep1/2 and
// messageYjsUpdate constants.
const SYNC_STEP_1 = 0;
const SYNC_STEP_2 = 1;
const SYNC_UPDATE = 2;

const messageEnvelopeSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal(MESSAGE_SYNC),
    syncType: z.union([z.literal(SYNC_STEP_1), z.literal(SYNC_STEP_2), z.literal(SYNC_UPDATE)]),
  }),
  z.object({ type: z.literal(MESSAGE_AWARENESS) }),
]);

export type MessageEnvelope = z.infer<typeof messageEnvelopeSchema>;

/**
 * Peeks at a raw wire message's header (message type, and sync sub-type when
 * present) without applying it to any document. Returns null for anything
 * that isn't a well-formed, recognized envelope — oversized frames, garbage/
 * truncated varints that throw while decoding, or a shape Zod doesn't
 * recognize (e.g. an unknown message or sync sub-type). Callers should drop
 * the message / close the connection on null rather than pass it on to
 * `applyIncomingMessage`, which assumes a well-formed frame.
 */
export function parseMessageEnvelope(message: Uint8Array): MessageEnvelope | null {
  if (message.byteLength > MAX_MESSAGE_BYTES) return null;

  try {
    const decoder = decoding.createDecoder(message);
    const type = decoding.readVarUint(decoder);
    const candidate = type === MESSAGE_SYNC ? { type, syncType: decoding.readVarUint(decoder) } : { type };
    const result = messageEnvelopeSchema.safeParse(candidate);
    return result.success ? result.data : null;
  } catch {
    // lib0/decoding throws (e.g. RangeError) on truncated or malformed
    // varints rather than returning a sentinel value.
    return null;
  }
}

/**
 * SyncStep1 (a read-only state-vector announcement) and awareness updates
 * (cursor/presence) never mutate the document; SyncStep2 and Update both
 * call Y.applyUpdate internally.
 */
export function isMutatingSyncMessage(envelope: MessageEnvelope): boolean {
  return envelope.type === MESSAGE_SYNC && envelope.syncType !== SYNC_STEP_1;
}
