import { NextResponse } from "next/server";
import { z } from "zod";
import { sql, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { withUserContext } from "@/db/with-user-context";
import { documentMembers } from "@/db/schema";
import { requireDocumentRole, ForbiddenError } from "@/lib/rbac/require-document-role";

const addMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(["editor", "viewer"]),
});

interface FindUserRow {
  [key: string]: unknown;
  id: string;
  email: string;
  name: string;
}

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

  const members = await withUserContext(userId, (tx) =>
    tx.select().from(documentMembers).where(eq(documentMembers.documentId, documentId)),
  );

  return NextResponse.json({ members });
}

export async function POST(request: Request, { params }: RouteParams): Promise<Response> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id: documentId } = await params;

  const body: unknown = await request.json().catch(() => null);
  const parsed = addMemberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid input" }, { status: 400 });
  }

  try {
    // only the owner can invite/manage members
    // (mirrors document_members_write_owner in 0001_rls_policies.sql)
    await requireDocumentRole(userId, documentId, ["owner"]);
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    throw err;
  }

  const member = await withUserContext(userId, async (tx) => {
    const rows = await tx.execute<FindUserRow>(
      sql`select * from find_user_by_email(${parsed.data.email})`,
    );
    const invitee = rows[0];
    if (!invitee) return null;

    const [row] = await tx
      .insert(documentMembers)
      .values({ documentId, userId: invitee.id, role: parsed.data.role })
      .onConflictDoUpdate({
        target: [documentMembers.documentId, documentMembers.userId],
        set: { role: parsed.data.role },
      })
      .returning();
    return row;
  });

  if (!member) return NextResponse.json({ error: "no user with that email" }, { status: 404 });

  return NextResponse.json({ member }, { status: 201 });
}
