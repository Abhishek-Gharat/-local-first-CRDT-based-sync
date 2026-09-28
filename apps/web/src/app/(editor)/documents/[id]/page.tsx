import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { withUserContext } from "@/db/with-user-context";
import { documentVersions, documents, users } from "@/db/schema";
import { requireDocumentRole, ForbiddenError } from "@/lib/rbac/require-document-role";
import { DocumentEditor } from "./document-editor";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { title: "docsync" };
  const { id } = await params;
  const document = await withUserContext(userId, async (tx) => {
    const [doc] = await tx
      .select({ title: documents.title })
      .from(documents)
      .where(eq(documents.id, id));
    return doc;
  }).catch(() => undefined);
  return { title: document ? `${document.title} — docsync` : "docsync" };
}

export default async function DocumentPage({ params }: PageProps) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");
  const { id: documentId } = await params;

  let role;
  try {
    role = await requireDocumentRole(userId, documentId, ["owner", "editor", "viewer"]);
  } catch (err) {
    if (err instanceof ForbiddenError) redirect("/documents");
    throw err;
  }

  const document = await withUserContext(userId, async (tx) => {
    const [doc] = await tx.select().from(documents).where(eq(documents.id, documentId));
    return doc;
  });
  if (!document) redirect("/documents");

  /**
   * Version authors and the owner name are resolved here rather than in the
   * versions API: those routes are member-scoped and must not hand out
   * profile rows, but the editor page already runs inside the member's RLS
   * context and may read exactly the collaborators it shares with.
   */
  const versionAuthors = await withUserContext(userId, async (tx) => {
    const rows = await tx
      .select({ authorId: documentVersions.authorId, name: users.name })
      .from(documentVersions)
      .innerJoin(users, eq(users.id, documentVersions.authorId))
      .where(eq(documentVersions.documentId, documentId));
    return Object.fromEntries(rows.map((row) => [row.authorId, row.name]));
  }).catch(() => ({}) as Record<string, string>);

  const ownerName = await withUserContext(userId, async (tx) => {
    const [row] = await tx
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, document.ownerId));
    return row?.name;
  })
    .then((name) => name ?? "A collaborator")
    .catch(() => "A collaborator");

  return (
    <DocumentEditor
      key={documentId}
      documentId={documentId}
      title={document.title}
      role={role}
      ownerName={ownerName}
      createdAt={document.createdAt.toISOString()}
      updatedAt={document.updatedAt.toISOString()}
      authorNames={versionAuthors}
      currentUser={{
        id: userId,
        name: session.user?.name || session.user?.email || "Anonymous",
      }}
    />
  );
}
