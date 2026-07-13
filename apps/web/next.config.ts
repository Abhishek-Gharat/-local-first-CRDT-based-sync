import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // "shared" ships untranspiled TS source (main/types point straight at
  // src/index.ts, no build step — see packages/shared/package.json) using
  // NodeNext-style ".js" extensions on relative imports, which tsc/tsx/Vitest
  // all resolve back to the sibling .ts file. Turbopack only extends that
  // same resolution to workspace packages listed here; without it, it tries
  // to literally resolve "./sync-protocol.js" and fails.
  transpilePackages: ["shared"],
  turbopack: {
    root: path.join(__dirname, "..", ".."),
  },
};

export default nextConfig;
