import { defineConfig, devices } from "@playwright/test";

// End-to-end config. Unlike the Vitest suites (which simulate Yjs docs in
// Node), these run the *real* stack in a headless browser: the Next.js app,
// the standalone sync-server, and Postgres. That's the only way to exercise
// the assignment's headline criteria the way a user actually hits them —
// two browser tabs, a real WebSocket, real offline/reconnect.
//
// Both servers are booted by Playwright below. The web app is served with
// `next start` against the production build (NEXT_PUBLIC_SYNC_SERVER_URL is
// baked in at build time, so the build must exist first — the CI job and the
// `test:e2e` script both build before running).
const WEB_PORT = 3000;
const SYNC_PORT = 1234;

export default defineConfig({
  testDir: "./e2e",
  // Yjs convergence and reconnect are timing-sensitive; give them room but
  // keep it bounded so a genuine hang still fails rather than blocking CI.
  timeout: 45_000,
  expect: { timeout: 10_000 },
  // These tests share one Postgres and one sync-server room namespace, and
  // each seeds/creates its own documents; running them serially keeps the
  // assertions deterministic and the logs readable.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "list" : "line",
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: [
    {
      // The sync-server has no build step (tsx runs the TS directly); load its
      // own .env so SYNC_TOKEN_SECRET matches the web app's.
      command: "pnpm exec tsx --env-file=.env src/index.ts",
      cwd: "../sync-server",
      port: SYNC_PORT,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: "pnpm start",
      port: WEB_PORT,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        // `next start` (production) doesn't auto-trust the request host the
        // way `next dev` does, so NextAuth rejects localhost as UntrustedHost.
        // This is the documented flag for running behind a known host/proxy —
        // exactly the e2e case (and any self-hosted deploy).
        AUTH_TRUST_HOST: "true",
      },
    },
  ],
});
