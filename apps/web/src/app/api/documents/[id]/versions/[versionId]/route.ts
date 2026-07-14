import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { withUserContext } from "@/db/with-user-context";
import { documentVersions } from "@/db/schema";
import { requireDocumentRole, ForbiddenError } from "@/lib/rbac/require-document-role";
import { encodeSnapshot } from "@/lib/history/codec";

interface RouteParams {
  params: Promise<{ id: string; versionId: string }>;
}

// Only this route returns the raw snapshot bytes (the list route omits
// them). Restoring is a client-side operation — the live Y.Doc only exists
// in the browser (IndexedDB + the sync-server WS connection), never on this
// server — so the client fetches the snapshot here, then applies the
// diff-based restore itself via restoreSnapshotIntoDoc(). Gated at
// editor/owner, same as capturing a version, since fetching this is only
// ever done as the first half of a restore (a write).
export async function GET(_request: Request, { params }: RouteParams): Promise<Response> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id: documentId, versionId } = await params;

  try {
    await requireDocumentRole(userId, documentId, ["owner", "editor"]);
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    throw err;
  }

  const version = await withUserContext(userId, async (tx) => {
    const [row] = await tx
      .select()
      .from(documentVersions)
      .where(and(eq(documentVersions.id, versionId), eq(documentVersions.documentId, documentId)));
    return row;
  });
  if (!version) return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json({
    version: {
      id: version.id,
      authorId: version.authorId,
      label: version.label,
      createdAt: version.createdAt,
      snapshot: encodeSnapshot(version.snapshot),
    },
  });
}
