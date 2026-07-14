import { describe, it, expect } from "vitest";
import * as encoding from "lib0/encoding";
import * as Y from "yjs";
import {
  parseMessageEnvelope,
  isMutatingSyncMessage,
  MAX_MESSAGE_BYTES,
} from "../sync-message-schema.js";
import {
  encodeSyncStep1,
  encodeUpdate,
  MESSAGE_SYNC,
  MESSAGE_AWARENESS,
} from "../sync-protocol.js";

describe("sync message validation", () => {
  it("accepts a well-formed SyncStep1 as a non-mutating sync message", () => {
    const doc = new Y.Doc();
    const envelope = parseMessageEnvelope(encodeSyncStep1(doc));
    expect(envelope).not.toBeNull();
    expect(envelope!.type).toBe(MESSAGE_SYNC);
    expect(isMutatingSyncMessage(envelope!)).toBe(false);
  });

  it("accepts a well-formed Update and flags it as mutating", () => {
    const doc = new Y.Doc();
    doc.getText("content").insert(0, "hello");
    const update = Y.encodeStateAsUpdate(doc);
    const envelope = parseMessageEnvelope(encodeUpdate(update));
    expect(envelope).not.toBeNull();
    expect(isMutatingSyncMessage(envelope!)).toBe(true);
  });

  it("accepts an awareness frame as non-mutating", () => {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
    encoding.writeVarUint8Array(encoder, new Uint8Array([1, 2, 3]));
    const envelope = parseMessageEnvelope(encoding.toUint8Array(encoder));
    expect(envelope).not.toBeNull();
    expect(isMutatingSyncMessage(envelope!)).toBe(false);
  });

  it("rejects an oversized payload by size, before any decode, without throwing", () => {
    // ~50MB of zero bytes — the scenario the plan calls out. The size check
    // short-circuits before createDecoder ever touches the buffer, so this
    // returns null cheaply rather than spiking memory decoding 50MB.
    const huge = new Uint8Array(50 * 1024 * 1024);
    expect(huge.byteLength).toBeGreaterThan(MAX_MESSAGE_BYTES);
    expect(parseMessageEnvelope(huge)).toBeNull();
  });

  it("rejects a well-formed-but-unknown message type (invalid shape)", () => {
    // a syntactically valid varint envelope, but message type 99 isn't one
    // the discriminated union recognizes
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, 99);
    expect(parseMessageEnvelope(encoding.toUint8Array(encoder))).toBeNull();
  });

  it("rejects a sync frame with an out-of-range sync sub-type", () => {
    // MESSAGE_SYNC header but sync sub-type 7 — not SyncStep1/2 or Update
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    encoding.writeVarUint(encoder, 7);
    expect(parseMessageEnvelope(encoding.toUint8Array(encoder))).toBeNull();
  });

  it("rejects a truncated sync frame (missing sub-type varint) without throwing", () => {
    // MESSAGE_SYNC header with no sync sub-type following — readVarUint on the
    // exhausted decoder throws internally; parse must swallow it and return null
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    expect(parseMessageEnvelope(encoding.toUint8Array(encoder))).toBeNull();
  });

  it("rejects an empty payload", () => {
    expect(parseMessageEnvelope(new Uint8Array(0))).toBeNull();
  });
});
