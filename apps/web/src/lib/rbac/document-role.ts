export type DocumentRole = "owner" | "editor" | "viewer";

export class ForbiddenError extends Error {
  constructor(message = "forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * The pure decision half of requireDocumentRole, split out on purpose: it's
 * the only part that's plain logic with no DB/Node dependency, so it's the
 * only part that can be unit-tested directly. require-document-role.ts
 * imports "server-only" (via db/with-user-context.ts), which throws
 * unconditionally when actually executed outside Next's own webpack
 * pipeline — including under Vitest — so that file can never be imported
 * from a test, even one gated behind a real Postgres connection.
 */
export function assertAllowedRole(
  role: DocumentRole | undefined,
  allowedRoles: readonly DocumentRole[],
): DocumentRole {
  if (!role || !allowedRoles.includes(role)) {
    throw new ForbiddenError();
  }
  return role;
}
