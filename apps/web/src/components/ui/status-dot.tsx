import { cn } from "@/lib/utils"
import type { ConnectionStatus as Status } from "@/lib/sync/sync-engine"

/**
 * The one place sync status is turned into colour, so the dashboard, the
 * editor bar and the landing page can never disagree about what "offline"
 * looks like. Colour is always paired with a shape/animation difference and
 * with text — never the only signal.
 */
const STATUS_TONE: Record<
  Status,
  { dot: string; text: string; surface: string; ring: string }
> = {
  online: {
    dot: "bg-success",
    text: "text-success",
    surface: "bg-success/10 border-success/25",
    ring: "",
  },
  syncing: {
    dot: "bg-warning",
    text: "text-warning",
    surface: "bg-warning/10 border-warning/25",
    ring: "ds-pulse-ring text-warning",
  },
  "conflict-resolved": {
    dot: "bg-info",
    text: "text-info",
    surface: "bg-info/10 border-info/25",
    ring: "",
  },
  offline: {
    dot: "bg-offline",
    text: "text-muted-foreground",
    surface: "bg-muted border-border",
    ring: "",
  },
}

export function statusTone(status: Status) {
  return STATUS_TONE[status]
}

function StatusDot({
  status,
  className,
}: {
  status: Status;
  className?: string;
}) {
  const tone = STATUS_TONE[status];
  return (
    <span
      aria-hidden
      data-status={status}
      className={cn(
        "inline-block size-1.5 shrink-0 rounded-full",
        tone.dot,
        tone.ring,
        className
      )}
    />
  )
}

export { StatusDot }
