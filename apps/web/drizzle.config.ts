import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  // Superuser connection — migrations (incl. CREATE POLICY/GRANT) need
  // admin privileges. The app itself never uses this; see APP_DATABASE_URL
  // in src/db/client.ts.
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
