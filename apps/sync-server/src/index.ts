import { createSyncServer } from "./server.js";

const port = Number(process.env.PORT ?? 1234);

const tokenSecret = process.env.SYNC_TOKEN_SECRET;

if (!tokenSecret) {
  throw new Error("SYNC_TOKEN_SECRET is not set");
}

createSyncServer(port, { tokenSecret });

console.log(`sync-server listening on port ${port}`);