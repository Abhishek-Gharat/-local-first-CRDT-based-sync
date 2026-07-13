import * as decoding from "lib0/decoding";
import * as syncProtocol from "y-protocols/sync";
import { MESSAGE_SYNC } from "shared";

/**
 * Peeks at a raw wire message's type without applying it, to decide whether
 * a viewer-role connection is allowed to send it. SyncStep1 (sync
 * sub-message type 0) is read-only — a side announcing its state vector —
 * but SyncStep2 (1) and Update (2) both call Y.applyUpdate internally, i.e.
 * mutate the document. Awareness messages (cursors/presence) are never
 * mutating and are always allowed regardless of role.
 */
export function isMutatingSyncMessage(message: Uint8Array): boolean {
  const decoder = decoding.createDecoder(message);
  const messageType = decoding.readVarUint(decoder);
  if (messageType !== MESSAGE_SYNC) return false;
  const syncMessageType = decoding.readVarUint(decoder);
  return (
    syncMessageType === syncProtocol.messageYjsSyncStep2 ||
    syncMessageType === syncProtocol.messageYjsUpdate
  );
}
