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
  // on email is what actually rejects a duplicate signup.
  try {
    const [user] = await db
      .insert(users)
      .values({ email, passwordHash, name })
      .returning({ id: users.id, email: users.email, name: users.name });
    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    if (err instanceof postgres.PostgresError && err.code === POSTGRES_UNIQUE_VIOLATION) {
      return NextResponse.json({ error: "email already registered" }, { status: 409 });
    }
    throw err;
  }
}
