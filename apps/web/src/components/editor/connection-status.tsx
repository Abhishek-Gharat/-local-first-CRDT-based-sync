"use client";

import type { ConnectionStatus as Status } from "@/lib/sync/sync-engine";
import { StatusDot, statusTone } from "@/components/ui/status-dot";
import { cn } from "@/lib/utils";

interface ConnectionStatusProps {
  status: Status;
  /** `bar` is the editor app bar chip; `inline` is the compact status-bar form. */
  variant?: "bar" | "inline";
}

// One row per possible status: the human-readable text (announced to screen
// readers), a longer explanation surfaced as a tooltip, and the aria-live
// politeness. "offline" is the only one worth interrupting for (assertive) —
// it means edits aren't reaching collaborators yet; everything else is
// incidental progress and announces politely so it doesn't talk over the
// user while they type.
const STATUS_META: Record<Status, { label: string; detail: string; live: "polite" | "assertive" }> = {
  online: {
    label: "Connected",
    detail: "Every change is reaching collaborators as you type",
    live: "polite",
  },
  syncing: {
    label: "Syncing…",
    detail: "Sending and receiving document updates",
    live: "polite",
  },
  "conflict-resolved": {
    label: "Merged concurrent edits",
    detail: "A collaborator's concurrent edits were merged — no changes lost",
    live: "polite",
  },
  offline: {
    label: "Offline",
    detail: "Editing locally; changes are saved on this device and sync when reconnected",
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
export function ConnectionStatus({ status, variant = "bar" }: ConnectionStatusProps) {
  const meta = STATUS_META[status];
  const tone = statusTone(status);

  return (
    <span
      role="status"
      aria-live={meta.live}
      data-status={status}
      title={meta.detail}
      className={cn(
        "inline-flex items-center gap-1.5 font-medium whitespace-nowrap",
        variant === "bar"
          ? "rounded-full border px-2.5 py-1 text-[11px] shadow-xs"
          : "text-[11px]",
        variant === "bar" ? tone.surface : "text-muted-foreground",
      )}
    >
      <StatusDot status={status} />
      <span className={cn(variant === "bar" && "truncate")}>{meta.label}</span>
    </span>
  );
}
