import { describe, it, expect } from "vitest";
import { mintSyncToken, verifySyncToken } from "../sync-token.js";

describe("sync token", () => {
  const secret = "test-secret";
  const payload = { userId: "user-1", documentId: "doc-1", role: "editor" as const };

  it("verifies a token minted with the same secret", () => {
    const token = mintSyncToken(payload, secret);
    const decoded = verifySyncToken(token, secret);
    expect(decoded).toMatchObject(payload);
  });

  it("rejects a token signed with a different secret", () => {
    const token = mintSyncToken(payload, secret);
    expect(verifySyncToken(token, "wrong-secret")).toBeNull();
  });

  it("rejects a tampered payload even if the signature looks well-formed", () => {
    const token = mintSyncToken(payload, secret);
    const [, signature] = token.split(".");
    const tamperedPayload = Buffer.from(
      JSON.stringify({ ...payload, role: "owner" }),
    ).toString("base64url");
    expect(verifySyncToken(`${tamperedPayload}.${signature}`, secret)).toBeNull();
  });

  it("rejects an expired token", () => {
    const token = mintSyncToken(payload, secret, -1);
    expect(verifySyncToken(token, secret)).toBeNull();
  });

  it("rejects a malformed token", () => {
    expect(verifySyncToken("not-a-real-token", secret)).toBeNull();
  });
});
