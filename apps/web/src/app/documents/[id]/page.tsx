import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { withUserContext } from "@/db/with-user-context";
import { documents } from "@/db/schema";
import { requireDocumentRole, ForbiddenError } from "@/lib/rbac/require-document-role";
import { eq } from "drizzle-orm";
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

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <DocumentEditor key={documentId} documentId={documentId} title={document.title} role={role} />
    </main>
  );
}
