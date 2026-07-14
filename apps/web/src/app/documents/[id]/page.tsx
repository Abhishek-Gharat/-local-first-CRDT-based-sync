import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { withUserContext } from "@/db/with-user-context";
import { documents } from "@/db/schema";
import { requireDocumentRole, ForbiddenError } from "@/lib/rbac/require-document-role";
import { eq } from "drizzle-orm";
import { DocumentEditor } from "./document-editor";

interface PageProps {
  params: Promise<{ id: string }>;
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
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-6 py-10">
      <DocumentEditor key={documentId} documentId={documentId} title={document.title} role={role} />
    </main>
  );
}
