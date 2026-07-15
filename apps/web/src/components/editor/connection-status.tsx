"use client";

import type { ConnectionStatus as Status } from "@/lib/sync/sync-engine";
import { cn } from "@/lib/utils";

interface ConnectionStatusProps {
  status: Status;
}

// One row per possible status: the human-readable text (announced to screen
// readers), a longer explanation surfaced as a tooltip, a dot colour, and the
// aria-live politeness. "offline" is the only one worth interrupting for
// (assertive) — it means edits aren't reaching collaborators yet; everything
// else is incidental progress and announces politely so it doesn't talk over
// the user while they type.
const STATUS_META: Record<
  Status,
  { label: string; detail: string; dotClass: string; live: "polite" | "assertive" }
> = {
  online: {
    label: "Connected",
    detail: "Changes sync live to collaborators",
    dotClass: "bg-emerald-500",
    live: "polite",
  },
  syncing: {
    label: "Syncing…",
    detail: "Sending and receiving changes",
    dotClass: "bg-amber-500 animate-pulse",
    live: "polite",
  },
  "conflict-resolved": {
    label: "Merged concurrent edits",
    detail: "A collaborator's concurrent edits were merged — no changes lost",
    dotClass: "bg-sky-500",
    live: "polite",
  },
  offline: {
    label: "Offline — will sync on reconnect",
    detail: "Editing locally; changes are saved on this device and sync when reconnected",
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
      title={meta.detail}
      className="inline-flex max-w-56 items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground"
    >
      <span
        aria-hidden
        className={cn("size-2 shrink-0 rounded-full transition-colors duration-300", meta.dotClass)}
      />
      <span className="truncate">{meta.label}</span>
    </span>
  );
}
