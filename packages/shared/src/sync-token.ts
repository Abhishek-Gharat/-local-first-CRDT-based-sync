import { createHmac, timingSafeEqual } from "node:crypto";

export type DocumentRole = "owner" | "editor" | "viewer";

export interface SyncTokenPayload {
  userId: string;
  documentId: string;
  role: DocumentRole;
  exp: number;
}

function base64url(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function sign(payloadB64: string, secret: string): string {
  return createHmac("sha256", secret).update(payloadB64).digest("base64url");
}

/**
 * Short-lived signed token proving "this user has this role on this
 * document," minted by the Next.js API (after a real document_members
 * check) and verified by sync-server on WS handshake — see
 * requireDocumentRole and the sync-token API route in apps/web, and the
 * connection handler in apps/sync-server (M7). HMAC over a JSON payload
 * rather than a full JWT library: both sides just need "did this shared
 * secret sign this exact payload, and has it expired," nothing else a JWT
 * gives you (header negotiation, alg confusion, etc.) is needed here.
 */
export function mintSyncToken(
  payload: Omit<SyncTokenPayload, "exp">,
  secret: string,
  ttlSeconds = 60,
): string {
  const full: SyncTokenPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const payloadB64 = base64url(JSON.stringify(full));
  return `${payloadB64}.${sign(payloadB64, secret)}`;
}

export function verifySyncToken(token: string, secret: string): SyncTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, signature] = parts;

  const expectedSignature = sign(payloadB64, secret);
  const signatureBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSignature);
  if (signatureBuf.length !== expectedBuf.length || !timingSafeEqual(signatureBuf, expectedBuf)) {
    return null;
  }

  let payload: SyncTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }
  return payload;
}
