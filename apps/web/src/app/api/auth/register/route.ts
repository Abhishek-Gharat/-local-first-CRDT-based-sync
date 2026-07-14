import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import postgres from "postgres";
import { z } from "zod";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { hashPassword } from "@/lib/auth/password";

const POSTGRES_UNIQUE_VIOLATION = "23505";

const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(200),
  name: z.string().trim().min(1).max(200),
});

export async function POST(request: Request): Promise<Response> {
  const body: unknown = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid input" }, { status: 400 });
  }
  const { email, password, name } = parsed.data;

  const passwordHash = await hashPassword(password);

  // users_insert_self's RLS policy is WITH CHECK (true) precisely so this
  // pre-auth insert can happen with no user context set — the unique index
  // on email is what actually rejects a duplicate signup. But `.returning()`
  // makes Postgres also check the table's SELECT policy against the new
  // row, and users_select_self requires id = app_current_user_id(), which
  // is null pre-auth — so a `.returning()` insert fails RLS even though the
  // insert itself is allowed. Generating the id client-side and skipping
  // `.returning()` avoids that read-back entirely; we already have every
  // field the response needs.
  const id = randomUUID();
  try {
    await db.insert(users).values({ id, email, passwordHash, name });
    const user = { id, email, name };
    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    if (err instanceof postgres.PostgresError && err.code === POSTGRES_UNIQUE_VIOLATION) {
      return NextResponse.json({ error: "email already registered" }, { status: 409 });
    }
    throw err;
  }
}
