import "server-only";
import { eq, and } from "drizzle-orm";
import { withUserContext } from "@/db/with-user-context";
import { documentMembers } from "@/db/schema";
import { assertAllowedRole, ForbiddenError, type DocumentRole } from "./document-role";

export { ForbiddenError };
export type { DocumentRole };

/**
 * RLS only proves membership (see documents_update_members /
 * document_versions_insert in 0001_rls_policies.sql — both permit any
 * member, not just owner/editor). Role distinctions between owner/editor/
 * viewer are an app-level check on top of that: look up the caller's role
 * within the same tenant-scoped transaction, then defer to
 * assertAllowedRole for the actual accept/reject decision.
 */
export async function requireDocumentRole(
  userId: string,
  documentId: string,
  allowedRoles: readonly DocumentRole[],
): Promise<DocumentRole> {
  const role = await withUserContext(userId, async (tx) => {
    const [membership] = await tx
      .select({ role: documentMembers.role })
      .from(documentMembers)
      .where(
        and(
          eq(documentMembers.documentId, documentId),
          eq(documentMembers.userId, userId),
        ),
      );
    return membership?.role;
  });

  return assertAllowedRole(role, allowedRoles);
}
