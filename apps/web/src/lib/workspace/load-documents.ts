import "server-only";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { withUserContext } from "@/db/with-user-context";
import { documents, documentMembers, users } from "@/db/schema";
import type { DocumentRole } from "shared";

export interface DocumentSummary {
  id: string;
  title: string;
  ownerId: string;
  ownerName: string;
  createdAt: string;
  updatedAt: string;
  role: DocumentRole;
  memberCount: number;
  versionCount: number;
  lastVersionAt: string | null;
}

/**
 * Everything the workspace needs to render a document row, in one
 * RLS-scoped pass: identity, ownership, membership size, and how much
 * checkpoint history the document has.
 *
 * Collaborator *names* and *e-mail* are deliberately not joined here — the
 * `users` table is only readable for people you actually share a document
 * with, and the dashboard shows member *counts*, not addresses. Owner names
 * are resolved separately below so a document whose owner was removed still
 * renders instead of vanishing from the list.
 */
export async function loadDocumentSummaries(
  userId: string,
): Promise<DocumentSummary[]> {
  return withUserContext(userId, async (tx) => {
    const rows = await tx
      .select({
        id: documents.id,
        title: documents.title,
        ownerId: documents.ownerId,
        createdAt: documents.createdAt,
        updatedAt: documents.updatedAt,
        role: documentMembers.role,
        memberCount: sql<number>`(
          select count(*)::int from document_members m
          where m.document_id = ${documents.id}
        )`,
        versionCount: sql<number>`(
          select count(*)::int from document_versions v
          where v.document_id = ${documents.id}
        )`,
        lastVersionAt: sql<Date | null>`(
          select max(v.created_at) from document_versions v
          where v.document_id = ${documents.id}
        )`,
      })
      .from(documents)
      .innerJoin(documentMembers, eq(documentMembers.documentId, documents.id))
      .where(eq(documentMembers.userId, userId))
      .orderBy(desc(documents.updatedAt));

    const ownerIds = [...new Set(rows.map((r) => r.ownerId))];
    if (ownerIds.length === 0) return [];

    const owners = await tx
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(inArray(users.id, ownerIds));
    const nameById = new Map(owners.map((o) => [o.id, o.name]));

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      ownerId: row.ownerId,
      ownerName: nameById.get(row.ownerId) ?? "Former member",
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      role: row.role,
      memberCount: Number(row.memberCount ?? 1),
      versionCount: Number(row.versionCount ?? 0),
      lastVersionAt: row.lastVersionAt
        ? new Date(row.lastVersionAt).toISOString()
        : null,
    }));
  });
}
