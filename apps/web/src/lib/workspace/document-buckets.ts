import type { DocumentSummary } from "@/lib/workspace/load-documents";

export type DocumentBucketId = "today" | "yesterday" | "week" | "earlier";

export interface DocumentBucket {
  id: DocumentBucketId;
  label: string;
  hint: string;
  documents: DocumentSummary[];
}

/**
 * Recency buckets for the workspace list.
 *
 * Grouping by *time band* rather than sorting one flat list is what turns a
 * wall of cards into a scannable workspace: the documents you touched today
 * are physically separated from ones you have not opened in a month, and the
 * section headers double as navigation.
 */
export const BUCKET_ORDER: DocumentBucketId[] = [
  "today",
  "yesterday",
  "week",
  "earlier",
];

const BUCKET_META: Record<
  DocumentBucketId,
  { label: string; hint: string }
> = {
  today: { label: "Today", hint: "Edited in the last 24 hours" },
  yesterday: { label: "Yesterday", hint: "Edited in the last 2 days" },
  week: { label: "Earlier this week", hint: "Edited in the last 7 days" },
  earlier: { label: "Older", hint: "Everything else" },
};

export function bucketFor(
  updatedAt: string,
  now: Date = new Date(),
): DocumentBucketId {
  const elapsed = now.getTime() - new Date(updatedAt).getTime();
  const days = elapsed / 86_400_000;
  if (days < 1) return "today";
  if (days < 2) return "yesterday";
  if (days < 7) return "week";
  return "earlier";
}

export function groupByRecency(
  documents: DocumentSummary[],
  now: Date = new Date(),
): DocumentBucket[] {
  const buckets = new Map<DocumentBucketId, DocumentSummary[]>(
    BUCKET_ORDER.map((id) => [id, []]),
  );
  for (const doc of documents) {
    buckets.get(bucketFor(doc.updatedAt, now))!.push(doc);
  }
  return BUCKET_ORDER.filter((id) => buckets.get(id)!.length > 0).map((id) => ({
    id,
    ...BUCKET_META[id],
    documents: buckets.get(id)!,
  }));
}

export type WorkspaceView = "all" | "owned" | "shared";

export function filterByView(
  documents: DocumentSummary[],
  view: WorkspaceView,
  userId: string,
): DocumentSummary[] {
  switch (view) {
    case "owned":
      return documents.filter((d) => d.ownerId === userId);
    case "shared":
      return documents.filter((d) => d.ownerId !== userId);
    default:
      return documents;
  }
}

export type SortKey = "updated" | "created" | "title";

export function sortDocuments(
  documents: DocumentSummary[],
  key: SortKey,
): DocumentSummary[] {
  const next = [...documents];
  next.sort((a, b) => {
    switch (key) {
      case "title":
        return a.title.localeCompare(b.title);
      case "created":
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      default:
        return (
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
    }
  });
  return next;
}
