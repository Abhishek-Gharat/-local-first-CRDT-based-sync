import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { withUserContext } from "@/db/with-user-context";
import { documentVersions } from "@/db/schema";
import { requireDocumentRole, ForbiddenError } from "@/lib/rbac/require-document-role";
import { decodeSnapshot } from "@/lib/history/codec";
import { snapshotToPlainText } from "@/lib/ai/snapshot-text";
import { diffSnapshotText } from "@/lib/ai/text-diff";
import { summarizeDiff } from "@/lib/ai/summarize";

// Mirrors the version route's cap — a snapshot posted here is the same kind of
// blob, so it gets the same upper bound.
const MAX_SNAPSHOT_BYTES = 5 * 1024 * 1024;

const summarySchema = z.object({
  // The saved version to compare against (the "before").
  fromVersionId: z.string().uuid(),
  // The current document state, base64-encoded Y.encodeStateAsUpdate (the "after").
  toSnapshot: z.string().min(1),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Generates a human-readable summary of what changed between a saved version
// and the current document. Reading a summary is a read, so viewers are
// allowed. The live "after" snapshot comes from the client (the Y.Doc only
// lives in the browser); the "before" is read from the DB by id so a client
// can't smuggle in arbitrary "before" text.
export async function POST(request: Request, { params }: RouteParams): Promise<Response> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id: documentId } = await params;

  const body: unknown = await request.json().catch(() => null);
  const parsed = summarySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid input" }, { status: 400 });
  }
  if (parsed.data.toSnapshot.length > MAX_SNAPSHOT_BYTES) {
    return NextResponse.json({ error: "snapshot too large" }, { status: 413 });
  }

  try {
    await requireDocumentRole(userId, documentId, ["owner", "editor", "viewer"]);
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    throw err;
  }

  const version = await withUserContext(userId, async (tx) => {
    const [row] = await tx
      .select({ snapshot: documentVersions.snapshot })
      .from(documentVersions)
      .where(
        and(
          eq(documentVersions.id, parsed.data.fromVersionId),
          eq(documentVersions.documentId, documentId),
        ),
      );
    return row;
  });
  if (!version) return NextResponse.json({ error: "not found" }, { status: 404 });

  let oldText: string;
  let newText: string;
  try {
    oldText = snapshotToPlainText(new Uint8Array(version.snapshot));
    newText = snapshotToPlainText(decodeSnapshot(parsed.data.toSnapshot));
  } catch {
    return NextResponse.json({ error: "invalid snapshot encoding" }, { status: 400 });
  }

  const diff = diffSnapshotText(oldText, newText);
  const { summary, aiGenerated } = await summarizeDiff(diff);

  return NextResponse.json({
    summary,
    aiGenerated,
    stats: { addedWords: diff.addedWords, removedWords: diff.removedWords },
  });
}
