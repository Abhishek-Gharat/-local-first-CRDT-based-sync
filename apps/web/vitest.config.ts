import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // Mirror the tsconfig "@/*" -> "src/*" path mapping so component tests
      // (which render real components that import via "@/...") resolve the
      // same way the Next build does. Production uses tsconfig paths; vitest
      // doesn't read those, so it's declared once here.
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    // Integration suites hit a real Postgres instance (Neon in dev/CI);
    // network round-trips comfortably exceed vitest's 5s/10s defaults.
    testTimeout: 20000,
    hookTimeout: 20000,
    // The e2e/ specs use @playwright/test's runner, not vitest — exclude them
    // so `vitest run` doesn't try to execute them (and fail on the missing
    // vitest globals). Playwright picks them up via playwright.config.ts.
    exclude: ["**/node_modules/**", "**/dist/**", "e2e/**"],
  },
});
