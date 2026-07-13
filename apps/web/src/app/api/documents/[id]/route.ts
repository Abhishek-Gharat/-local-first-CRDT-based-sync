import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { withUserContext } from "@/db/with-user-context";
import { documents } from "@/db/schema";
import { requireDocumentRole, ForbiddenError } from "@/lib/rbac/require-document-role";

const updateDocumentSchema = z.object({
  title: z.string().trim().min(1).max(200),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams): Promise<Response> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  try {
    // any role (owner/editor/viewer) may read
    await requireDocumentRole(userId, id, ["owner", "editor", "viewer"]);
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    throw err;
  }

  const document = await withUserContext(userId, async (tx) => {
    const [doc] = await tx.select().from(documents).where(eq(documents.id, id));
    return doc;
  });
  if (!document) return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json({ document });
}

export async function PATCH(request: Request, { params }: RouteParams): Promise<Response> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  const body: unknown = await request.json().catch(() => null);
  const parsed = updateDocumentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid input" }, { status: 400 });
  }

  try {
    // renaming is a write, so viewers are excluded
    await requireDocumentRole(userId, id, ["owner", "editor"]);
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    throw err;
  }

  const document = await withUserContext(userId, async (tx) => {
    const [doc] = await tx
      .update(documents)
      .set({ title: parsed.data.title, updatedAt: new Date() })
      .where(eq(documents.id, id))
      .returning();
    return doc;
  });
  if (!document) return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json({ document });
}

export async function DELETE(_request: Request, { params }: RouteParams): Promise<Response> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  try {
    // deletion is owner-only, stricter than the RLS documents_delete_owner
    // policy alone would need to be if RBAC weren't checked here too
    await requireDocumentRole(userId, id, ["owner"]);
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    throw err;
  }

  await withUserContext(userId, (tx) => tx.delete(documents).where(eq(documents.id, id)));

  return new Response(null, { status: 204 });
}
