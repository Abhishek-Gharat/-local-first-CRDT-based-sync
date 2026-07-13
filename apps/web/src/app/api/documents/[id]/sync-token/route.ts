import { NextResponse } from "next/server";
import { mintSyncToken } from "shared";
import { auth } from "@/auth";
import { requireDocumentRole, ForbiddenError } from "@/lib/rbac/require-document-role";

const SYNC_TOKEN_TTL_SECONDS = 60;

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Mints a short-lived signed token proving the caller's role on this
// document, for the browser client to present on the sync-server WS
// handshake. sync-server (M7) verifies it with the same shared secret and
// rejects update frames from viewer-role connections at the message layer,
// not just by hiding write UI client-side.
export async function GET(_request: Request, { params }: RouteParams): Promise<Response> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id: documentId } = await params;

  const secret = process.env.SYNC_TOKEN_SECRET;
  if (!secret) {
    throw new Error("SYNC_TOKEN_SECRET is not set");
  }

  let role;
  try {
    role = await requireDocumentRole(userId, documentId, ["owner", "editor", "viewer"]);
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    throw err;
  }

  const token = mintSyncToken({ userId, documentId, role }, secret, SYNC_TOKEN_TTL_SECONDS);

  return NextResponse.json({ token, role, expiresInSeconds: SYNC_TOKEN_TTL_SECONDS });
}
