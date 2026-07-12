import "server-only";
import { sql } from "drizzle-orm";
import type { PgTransaction } from "drizzle-orm/pg-core";
import { db } from "./client";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Every query that touches tenant-scoped tables must go through this.
 *
 * It opens a transaction and sets `app.current_user_id` via set_config(...,
 * true) — the `true` makes it transaction-local (equivalent to `SET LOCAL`,
 * but parameterized, so the user id can't be used for SQL injection the way
 * string-interpolating a raw `SET LOCAL` statement would allow).
 *
 * Postgres RLS policies on documents/document_members/document_versions read
 * that setting to decide what rows exist for this transaction. Even a query
 * inside `fn` that forgets a WHERE clause can't see another tenant's rows —
 * the database enforces it, not the application code.
 */
export async function withUserContext<T>(
  userId: string,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('app.current_user_id', ${userId}, true)`,
    );
    return fn(tx);
  });
}

export type { PgTransaction };
