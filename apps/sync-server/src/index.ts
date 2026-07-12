import { createSyncServer } from "./server.js";

const port = Number(process.env.SYNC_SERVER_PORT ?? 1234);
createSyncServer(port);
console.log(`sync-server listening on ws://localhost:${port}`);
