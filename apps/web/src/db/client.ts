import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Deliberately APP_DATABASE_URL, not DATABASE_URL: the app must connect as
// the restricted, non-superuser app_user role for RLS to mean anything.
// DATABASE_URL (superuser) is for drizzle-kit migrations only — see
// src/db/migrations/0001_rls_policies.sql.
const connectionString = process.env.APP_DATABASE_URL;
if (!connectionString) {
  throw new Error("APP_DATABASE_URL is not set");
}

// one pooled connection per process — reused across requests in dev/serverless
const client = postgres(connectionString, { max: 10 });

export const db = drizzle(client, { schema });
