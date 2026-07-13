import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    // Integration suites hit a real Postgres instance (Neon in dev/CI);
    // network round-trips comfortably exceed vitest's 5s/10s defaults.
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
