import { NextResponse } from "next/server";
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { withUserContext } from "@/db/with-user-context";
import { documentVersions } from "@/db/schema";
import { requireDocumentRole, ForbiddenError } from "@/lib/rbac/require-document-role";
import { decodeSnapshot } from "@/lib/history/codec";

// Yjs updates are typically KBs, but an unbounded editing session could
// produce a large encodeStateAsUpdate() blob; this caps a single snapshot
// well above any realistic document while still bounding request size.
const MAX_SNAPSHOT_BYTES = 5 * 1024 * 1024;

const createVersionSchema = z.object({
  label: z.string().trim().min(1).max(200).optional(),
  snapshot: z.string().min(1),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams): Promise<Response> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id: documentId } = await params;

  try {
    await requireDocumentRole(userId, documentId, ["owner", "editor", "viewer"]);
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    throw err;
  }

  const versions = await withUserContext(userId, (tx) =>
    tx
      .select({
        id: documentVersions.id,
        authorId: documentVersions.authorId,
        label: documentVersions.label,
        createdAt: documentVersions.createdAt,
      })
      .from(documentVersions)
      .where(eq(documentVersions.documentId, documentId))
      .orderBy(desc(documentVersions.createdAt)),
  );

  // snapshot bytes are omitted from the list response on purpose — they're
  // only needed by the restore route, and can be large; GET /versions/:id
  // isn't needed since restore reads the row itself.
  return NextResponse.json({ versions });
}

export async function POST(request: Request, { params }: RouteParams): Promise<Response> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id: documentId } = await params;

  const body: unknown = await request.json().catch(() => null);
  const parsed = createVersionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid input" }, { status: 400 });
  }
  if (parsed.data.snapshot.length > MAX_SNAPSHOT_BYTES) {
    return NextResponse.json({ error: "snapshot too large" }, { status: 413 });
  }

  try {
    // capturing a snapshot isn't itself a document edit, but only members
    // who can write should be able to pin a restore point
    await requireDocumentRole(userId, documentId, ["owner", "editor"]);
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    throw err;
  }

  let snapshotBuffer: Buffer;
  try {
    snapshotBuffer = Buffer.from(decodeSnapshot(parsed.data.snapshot));
  } catch {
    return NextResponse.json({ error: "invalid snapshot encoding" }, { status: 400 });
  }

  const version = await withUserContext(userId, async (tx) => {
    const [row] = await tx
      .insert(documentVersions)
      .values({
        documentId,
        authorId: userId,
        label: parsed.data.label,
        snapshot: snapshotBuffer,
      })
      .returning({
        id: documentVersions.id,
        authorId: documentVersions.authorId,
        label: documentVersions.label,
        createdAt: documentVersions.createdAt,
      });
    return row;
  });

  return NextResponse.json({ version }, { status: 201 });
}
