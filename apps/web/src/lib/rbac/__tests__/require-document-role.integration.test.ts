import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { sql, eq, and, inArray } from "drizzle-orm";
import * as schema from "../../../db/schema.js";

const adminUrl = process.env.DATABASE_URL;
const appUrl = process.env.APP_DATABASE_URL;

type AppTx = Parameters<Parameters<ReturnType<typeof drizzle>["transaction"]>[0]>[0];

// Proves the DB-level half of requireDocumentRole (apps/web/src/lib/rbac/
// require-document-role.ts) against real Postgres: that a member's own role
// on a document can be read back per-tenant. The role *decision* (is that
// role in the allowed set?) is pure logic, covered by document-role.test.ts
// with no DB involved.
//
// This test deliberately does NOT import require-document-role.ts (or
// db/with-user-context.ts) — both pull in db/client.ts's `import
// "server-only"`, and the real `server-only` package throws unconditionally
// when actually executed outside Next's own webpack pipeline, Vitest
// included. Reimplementing the same tenant-scoped query locally (mirroring
// rls.integration.test.ts's own `asUser` helper) proves the query is
// correct without ever loading that module under Vitest. Needs Docker
// Postgres; skipped cleanly otherwise.
describe.skipIf(!adminUrl || !appUrl)("document member role lookup (RBAC DB layer)", () => {
  const admin = postgres(adminUrl as string, { max: 1 });
  const adminDb = drizzle(admin, { schema });
  const app = postgres(appUrl as string, { max: 1 });
  const appDb = drizzle(app, { schema });

  let owner: typeof schema.users.$inferSelect;
  let viewer: typeof schema.users.$inferSelect;
  let outsider: typeof schema.users.$inferSelect;
  let doc: typeof schema.documents.$inferSelect;

  async function roleOf(userId: string, documentId: string) {
    return appDb.transaction(async (tx: AppTx) => {
      await tx.execute(sql`select set_config('app.current_user_id', ${userId}, true)`);
      const [membership] = await tx
        .select({ role: schema.documentMembers.role })
        .from(schema.documentMembers)
        .where(
          and(
            eq(schema.documentMembers.documentId, documentId),
            eq(schema.documentMembers.userId, userId),
          ),
        );
      return membership?.role;
    });
  }

  beforeAll(async () => {
    await migrate(adminDb, { migrationsFolder: "./src/db/migrations" });

    const suffix = Math.random().toString(36).slice(2);
    [owner] = await adminDb
      .insert(schema.users)
      .values({ email: `owner-${suffix}@test.local`, passwordHash: "x", name: "Owner" })
      .returning();
    [viewer] = await adminDb
      .insert(schema.users)
      .values({ email: `viewer-${suffix}@test.local`, passwordHash: "x", name: "Viewer" })
      .returning();
    [outsider] = await adminDb
      .insert(schema.users)
      .values({ email: `outsider-${suffix}@test.local`, passwordHash: "x", name: "Outsider" })
      .returning();

    [doc] = await adminDb
      .insert(schema.documents)
      .values({ ownerId: owner.id, title: "RBAC test doc" })
      .returning();
    await adminDb.insert(schema.documentMembers).values([
      { documentId: doc.id, userId: owner.id, role: "owner" },
      { documentId: doc.id, userId: viewer.id, role: "viewer" },
    ]);
  });

  afterAll(async () => {
    await adminDb
      .delete(schema.users)
      .where(inArray(schema.users.id, [owner.id, viewer.id, outsider.id]));
    await app.end();
    await admin.end();
  });

  it("reads back the caller's own role on a document they're a member of", async () => {
    await expect(roleOf(owner.id, doc.id)).resolves.toBe("owner");
    await expect(roleOf(viewer.id, doc.id)).resolves.toBe("viewer");
  });

  it("returns no role for a user who isn't a member of the document", async () => {
    await expect(roleOf(outsider.id, doc.id)).resolves.toBeUndefined();
  });
});
