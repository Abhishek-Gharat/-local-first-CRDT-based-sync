"use client";

import type { ConnectionStatus as Status } from "@/lib/sync/sync-engine";
import { cn } from "@/lib/utils";

interface ConnectionStatusProps {
  status: Status;
}

// One row per possible status: the human-readable text (announced to screen
// readers), a dot colour, and the aria-live politeness. "offline" is the only
// one worth interrupting for (assertive) — it means edits aren't reaching
// collaborators yet; everything else is incidental progress and announces
// politely so it doesn't talk over the user while they type.
const STATUS_META: Record<
  Status,
  { label: string; dotClass: string; live: "polite" | "assertive" }
> = {
  online: {
    label: "Connected — changes sync live",
    dotClass: "bg-emerald-500",
    live: "polite",
  },
  syncing: {
    label: "Syncing changes…",
    dotClass: "bg-amber-500 animate-pulse",
    live: "polite",
  },
  "conflict-resolved": {
    label: "Merged a collaborator's concurrent edits — no changes lost",
    dotClass: "bg-sky-500",
    live: "polite",
  },
  offline: {
    label: "Offline — editing locally, will sync when reconnected",
    dotClass: "bg-muted-foreground",
    live: "assertive",
  },
};

/**
 * Live connection/sync indicator. The status text lives in an `aria-live`
 * region so screen-reader users hear transitions (offline → syncing →
 * online, or a conflict-resolved merge) as they happen, not just sighted
 * users watching the coloured dot. The dot is `aria-hidden` — it's redundant
 * decoration over the already-announced text.
 */
export function ConnectionStatus({ status }: ConnectionStatusProps) {
  const meta = STATUS_META[status];
  return (
    <span
      role="status"
      aria-live={meta.live}
      data-status={status}
      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
    >
      <span aria-hidden className={cn("size-2 shrink-0 rounded-full", meta.dotClass)} />
      {meta.label}
    </span>
  );
}
