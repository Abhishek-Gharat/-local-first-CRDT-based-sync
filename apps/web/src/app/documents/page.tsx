import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { withUserContext } from "@/db/with-user-context";
import { documents, documentMembers } from "@/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NewDocumentForm } from "./new-document-form";
import { SignOutButton } from "./sign-out-button";

export default async function DocumentsPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const rows = await withUserContext(userId, (tx) =>
    tx
      .select({
        id: documents.id,
        title: documents.title,
        updatedAt: documents.updatedAt,
        role: documentMembers.role,
      })
      .from(documents)
      .innerJoin(documentMembers, eq(documentMembers.documentId, documents.id))
      .where(eq(documentMembers.userId, userId)),
  );

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">Your documents</h1>
        <SignOutButton />
      </div>

      <NewDocumentForm />

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No documents yet — create one above to get started.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <li key={row.id}>
              <Link href={`/documents/${row.id}`}>
                <Card className="transition-colors hover:bg-muted">
                  <CardHeader className="flex-row items-center justify-between">
                    <CardTitle className="text-base">{row.title}</CardTitle>
                    <Badge variant="secondary">{row.role}</Badge>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      Updated {row.updatedAt.toLocaleString()}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
