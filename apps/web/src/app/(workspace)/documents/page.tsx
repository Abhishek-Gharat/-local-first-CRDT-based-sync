import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { loadDocumentSummaries } from "@/lib/workspace/load-documents";
import { DocumentsWorkspace } from "@/components/workspace/documents-workspace";
import type { WorkspaceView } from "@/lib/workspace/document-buckets";

interface DocumentsPageProps {
  searchParams: Promise<{ view?: string }>;
}

const VIEWS: WorkspaceView[] = ["all", "owned", "shared"];

export default async function DocumentsPage({ searchParams }: DocumentsPageProps) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  // Sidebar links deep-link into a view (?view=owned); anything unrecognised
  // falls back to the default rather than 404-ing a navigation target.
  const params = await searchParams;
  const initialView: WorkspaceView = VIEWS.includes(params.view as WorkspaceView)
    ? (params.view as WorkspaceView)
    : "all";

  const documents = await loadDocumentSummaries(userId);

  return (
    <DocumentsWorkspace
      documents={documents}
      currentUserId={userId}
      currentUserName={session?.user?.name || session?.user?.email || "you"}
      initialView={initialView}
    />
  );
}
