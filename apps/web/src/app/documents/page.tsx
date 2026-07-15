import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { FileText } from "lucide-react";
import { auth } from "@/auth";
import { withUserContext } from "@/db/with-user-context";
import { documents, documentMembers } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { NewDocumentForm } from "./new-document-form";

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
      .where(eq(documentMembers.userId, userId))
      .orderBy(desc(documents.updatedAt)),
  );

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Documents</h1>
          <p className="text-sm text-muted-foreground">
            {rows.length === 0
              ? "Everything you create or get invited to lives here."
              : `${rows.length} document${rows.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <NewDocumentForm />
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-20 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-muted">
            <FileText aria-hidden className="size-5 text-muted-foreground" />
          </span>
          <div>
            <p className="text-sm font-medium">No documents yet</p>
            <p className="text-sm text-muted-foreground">
              Create your first document — it works even offline.
            </p>
          </div>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => (
            <li key={row.id}>
              <Link
                href={`/documents/${row.id}`}
                className="group flex h-full flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-all hover:border-ring/40 hover:shadow-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FileText aria-hidden className="size-4" />
                  </span>
                  <Badge variant="secondary" className="capitalize">
                    {row.role}
                  </Badge>
                </div>
                <div className="flex flex-1 flex-col gap-1">
                  <h2 className="line-clamp-2 text-sm font-medium group-hover:underline group-hover:underline-offset-4">
                    {row.title}
                  </h2>
                  <p className="mt-auto text-xs text-muted-foreground">
                    Updated {formatRelativeTime(row.updatedAt)}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
