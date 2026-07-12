// y-indexeddb needs a global `indexedDB` — vitest runs in Node, which has
// none, so every test file gets this fake in-memory implementation instead
// of needing to import it per-file.
import "fake-indexeddb/auto";
