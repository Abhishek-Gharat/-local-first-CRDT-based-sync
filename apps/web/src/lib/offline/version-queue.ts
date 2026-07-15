interface PendingVersion {
  id?: number;
  documentId: string;
  snapshot: string;
  createdAt: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("docsync-version-queue", 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("pending", {
        keyPath: "id",
        autoIncrement: true,
      });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function queueVersion(documentId: string, snapshot: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("pending", "readwrite");
    tx.objectStore("pending").add({ documentId, snapshot, createdAt: new Date().toISOString() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getQueuedVersions(documentId: string): Promise<PendingVersion[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("pending", "readonly");
    const store = tx.objectStore("pending");
    const all: PendingVersion[] = [];
    const request = store.openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        const value = cursor.value as PendingVersion;
        if (value.documentId === documentId) all.push(value);
        cursor.continue();
      }
    };
    tx.oncomplete = () => resolve(all);
    tx.onerror = () => reject(tx.error);
  });
}

async function deletePendingVersion(id: number): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("pending", "readwrite");
    tx.objectStore("pending").delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function flushVersionQueue(documentId: string): Promise<void> {
  const pending = await getQueuedVersions(documentId);
  for (const version of pending) {
    try {
      const response = await fetch(`/api/documents/${documentId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshot: version.snapshot }),
      });
      if (response.ok) {
        await deletePendingVersion(version.id!);
      }
    } catch {
      // still offline or transient error — leave in queue
    }
  }
}
