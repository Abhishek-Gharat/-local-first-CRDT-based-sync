import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type Db = ReturnType<typeof drizzle<typeof schema>>;

// Deliberately APP_DATABASE_URL, not DATABASE_URL: the app must connect as
// the restricted, non-superuser app_user role for RLS to mean anything.
// DATABASE_URL (superuser) is for drizzle-kit migrations only — see
// src/db/migrations/0001_rls_policies.sql.
//
// Lazily constructed (not at module scope): Next's build-time "collecting
// page data" step imports every route module, including ones that pull this
// in transitively, with no real env configured. An eager connection attempt
// here would fail the production build itself, not just requests.
const globalForDb = globalThis as unknown as {
  lazyDb?: Db;
  postgresClient?: ReturnType<typeof postgres>;
};

function getDb(): Db {
  if (globalForDb.lazyDb) return globalForDb.lazyDb;

  const connectionString = process.env.APP_DATABASE_URL;
  if (!connectionString) {
    throw new Error("APP_DATABASE_URL is not set");
  }

  // one pooled connection per process — reused across requests in dev/serverless
  if (!globalForDb.postgresClient) {
    globalForDb.postgresClient = postgres(connectionString, { max: 10 });
  }
  globalForDb.lazyDb = drizzle(globalForDb.postgresClient, { schema });
  return globalForDb.lazyDb;
}

export const db: Db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});
