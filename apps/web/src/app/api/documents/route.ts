import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { withUserContext } from "@/db/with-user-context";
import { documents, documentMembers } from "@/db/schema";

const createDocumentSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
});

export async function GET(): Promise<Response> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const rows = await withUserContext(userId, (tx) =>
    tx
      .select({
        id: documents.id,
        title: documents.title,
        ownerId: documents.ownerId,
        createdAt: documents.createdAt,
        updatedAt: documents.updatedAt,
        role: documentMembers.role,
      })
      .from(documents)
      .innerJoin(
        documentMembers,
        eq(documentMembers.documentId, documents.id),
      )
      .where(eq(documentMembers.userId, userId)),
  );

  return NextResponse.json({ documents: rows });
}

export async function POST(request: Request): Promise<Response> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = createDocumentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid input" }, { status: 400 });
  }

  const document = await withUserContext(userId, async (tx) => {
    const [doc] = await tx
      .insert(documents)
      .values({ ownerId: userId, ...(parsed.data.title ? { title: parsed.data.title } : {}) })
      .returning();
    await tx.insert(documentMembers).values({
      documentId: doc.id,
      userId,
      role: "owner",
    });
    return doc;
  });

  return NextResponse.json({ document }, { status: 201 });
}
