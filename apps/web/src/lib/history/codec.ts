// Snapshot bytes cross two very different runtimes on their way to Postgres:
// the browser (Y.encodeStateAsUpdate output, posted as JSON) and the Next.js
// server (bytea column). `Buffer` only exists on the server, so both
// directions fall back to atob/btoa when it's unavailable rather than
// assuming a Node environment.
export function encodeSnapshot(update: Uint8Array): string {
  if (typeof Buffer !== "undefined") return Buffer.from(update).toString("base64");
  let binary = "";
  for (const byte of update) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function decodeSnapshot(base64: string): Uint8Array {
  if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(base64, "base64"));
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
