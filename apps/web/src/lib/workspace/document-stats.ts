import "server-only";
import { eq, inArray, sql } from "drizzle-orm";
import { withUserContext } from "@/db/with-user-context";
import { documentMembers, documentVersions, documents } from "@/db/schema";

export interface DocumentStats {
  total: number;
  owned: number;
  shared: number;
  /** Total checkpoints across every document this user can reach. */
  versions: number;
}

/**
 * Aggregate counts for the workspace sidebar. Computed through the same
 * RLS-scoped connection as everything else, so the sidebar can never advertise
 * a document the user is not actually allowed to open.
 */
export async function countDocumentStats(userId: string): Promise<DocumentStats> {
  return withUserContext(userId, async (tx) => {
    const [membership] = await tx
      .select({
        total: sql<number>`count(*)::int`,
        owned: sql<number>`count(*) filter (where ${documents.ownerId} = ${userId})::int`,
        shared: sql<number>`count(*) filter (where ${documents.ownerId} <> ${userId})::int`,
      })
      .from(documents)
      .innerJoin(documentMembers, eq(documentMembers.documentId, documents.id))
      .where(eq(documentMembers.userId, userId));

    const total = Number(membership?.total ?? 0);

    // A second pass for versions: cheaper to gather the accessible ids once
    // and then count in a single grouped query than to nest a subquery per row.
    const visible = await tx
      .select({ id: documents.id })
      .from(documents)
      .innerJoin(documentMembers, eq(documentMembers.documentId, documents.id))
      .where(eq(documentMembers.userId, userId));

    let versions = 0;
    if (visible.length > 0) {
      const [row] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(documentVersions)
        .where(
          inArray(
            documentVersions.documentId,
            visible.map((d) => d.id),
          ),
        );
      versions = Number(row?.n ?? 0);
    }

    return {
      total,
      owned: Number(membership?.owned ?? 0),
      shared: Number(membership?.shared ?? 0),
      versions,
    };
  });
}
