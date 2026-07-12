import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { sql, inArray } from "drizzle-orm";
import * as schema from "../schema";

const adminUrl = process.env.DATABASE_URL;
const appUrl = process.env.APP_DATABASE_URL;

type AppTx = Parameters<Parameters<ReturnType<typeof drizzle>["transaction"]>[0]>[0];

// Proves tenant isolation against a real Postgres: a second tenant's bare
// `SELECT * FROM documents` (no WHERE clause at all) must come back empty
// because the database enforces it, not because the query happened to
// filter correctly. Needs `docker compose up -d postgres` (which also
// provisions the non-superuser app_user role — see docker/init-app-role.sh)
// with both DATABASE_URL and APP_DATABASE_URL set; skipped otherwise so
// `pnpm test` still passes without Docker. CI always sets both.
describe.skipIf(!adminUrl || !appUrl)("RLS tenant isolation", () => {
  const admin = postgres(adminUrl as string, { max: 1 });
  const adminDb = drizzle(admin, { schema });
  const app = postgres(appUrl as string, { max: 1 });
  const appDb = drizzle(app, { schema });

  let userA: typeof schema.users.$inferSelect;
  let userB: typeof schema.users.$inferSelect;
  let doc: typeof schema.documents.$inferSelect;

  async function asUser<T>(
    userId: string,
    fn: (tx: AppTx) => Promise<T>,
  ): Promise<T> {
    return appDb.transaction(async (tx) => {
      await tx.execute(
        sql`select set_config('app.current_user_id', ${userId}, true)`,
      );
      return fn(tx);
    });
  }

  beforeAll(async () => {
    await migrate(adminDb, { migrationsFolder: "./src/db/migrations" });

    const suffix = Math.random().toString(36).slice(2);

    // seeded via the admin (superuser) connection, which bypasses RLS
    // entirely — setup shouldn't depend on the policies under test
    [userA] = await adminDb
      .insert(schema.users)
      .values({ email: `a-${suffix}@test.local`, passwordHash: "x", name: "User A" })
      .returning();
    [userB] = await adminDb
      .insert(schema.users)
      .values({ email: `b-${suffix}@test.local`, passwordHash: "x", name: "User B" })
      .returning();

    doc = await asUser(userA.id, async (tx) => {
      const [d] = await tx
        .insert(schema.documents)
        .values({ ownerId: userA.id, title: "A's doc" })
        .returning();
      await tx
        .insert(schema.documentMembers)
        .values({ documentId: d.id, userId: userA.id, role: "owner" });
      await tx
        .insert(schema.documentVersions)
        .values({ documentId: d.id, authorId: userA.id, snapshot: Buffer.from("v1") });
      return d;
    });
  });

  afterAll(async () => {
    // cascade-deletes documents/document_members/document_versions too;
    // only the admin connection can do this (users has no delete policy)
    await adminDb.delete(schema.users).where(inArray(schema.users.id, [userA.id, userB.id]));
    await app.end();
    await admin.end();
  });

  it("hides another tenant's documents from a bare SELECT with no WHERE clause", async () => {
    const rows = await asUser(userB.id, (tx) => tx.select().from(schema.documents));
    expect(rows).toHaveLength(0);
  });

  it("hides another tenant's document_members rows", async () => {
    const rows = await asUser(userB.id, (tx) => tx.select().from(schema.documentMembers));
    expect(rows).toHaveLength(0);
  });

  it("hides another tenant's version history", async () => {
    const rows = await asUser(userB.id, (tx) => tx.select().from(schema.documentVersions));
    expect(rows).toHaveLength(0);
  });

  it("lets the owning tenant see their own document", async () => {
    const rows = await asUser(userA.id, (tx) => tx.select().from(schema.documents));
    expect(rows.map((r) => r.id)).toContain(doc.id);
  });

  it("blocks a non-member from inserting membership into someone else's document", async () => {
    await expect(
      asUser(userB.id, (tx) =>
        tx
          .insert(schema.documentMembers)
          .values({ documentId: doc.id, userId: userB.id, role: "editor" }),
      ),
    ).rejects.toThrow();
  });
});
