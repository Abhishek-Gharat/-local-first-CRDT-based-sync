"use client";

import { useEffect, useState } from "react";
import { CloudOff, Eye, Loader2, Radio } from "lucide-react";
import type { ConnectionStatus as Status } from "@/lib/sync/sync-engine";
import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/ui/status-dot";
import { cn } from "@/lib/utils";

/**
 * Full-width network banner.
 *
 * Only rendered for states the user must act on or would otherwise be
 * surprised by — offline, reconnecting, or a concurrent-edit merge. "Online"
 * is deliberately silent: a permanent green banner teaches people to ignore
 * banners, which is exactly when an offline notice stops working.
 */
export function NetworkBanner({
  status,
  offline,
  onRetry,
}: {
  status: Status;
  offline: boolean;
  onRetry?: () => void;
}) {
  if (!offline && status !== "syncing" && status !== "conflict-resolved") {
    return null;
  }

  if (offline) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-border bg-muted px-4 py-2 text-xs sm:px-6"
      >
        <CloudOff aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
        <p className="min-w-0 flex-1 text-muted-foreground">
          <span className="font-medium text-foreground">You are offline.</span>{" "}
          Keep writing — every change is stored in this browser and will sync
          the moment the connection returns.
        </p>
        {onRetry && (
          <Button variant="outline" size="xs" onClick={onRetry} className="font-medium">
            Retry now
          </Button>
        )}
      </div>
    );
  }

  if (status === "syncing") {
    return (
      <div
        aria-live="polite"
        className="flex items-center gap-2 border-b border-warning/25 bg-warning/10 px-4 py-1.5 text-[11px] font-medium text-foreground sm:px-6"
      >
        <StatusDot status="syncing" />
        Reconciling local and remote state…
      </div>
    );
  }

  return (
    <div
      aria-live="polite"
      className="flex items-center gap-2 border-b border-info/25 bg-info/10 px-4 py-1.5 text-[11px] text-foreground sm:px-6"
    >
      <Radio aria-hidden className="size-3.5 shrink-0 text-info" />
      Concurrent edits from a collaborator were merged automatically — nothing
      was overwritten.
    </div>
  );
}

/**
 * Read-only notice for viewers. Replaces the old thin grey strip under the
 * content: the point of the state is that it is *not a mistake*, so it
 * explains the enforcement rather than apologising for a missing feature.
 */
export function ViewerNotice({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3",
        className,
      )}
    >
      <span
        aria-hidden
        className="mt-px flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
      >
        <Eye className="size-3.5" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-foreground">You have view-only access</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
          You can read this document and follow live edits, but the sync server
          rejects writes from viewers at the protocol level — so editing is off
          even if the field were tampered with. Ask the owner for editor access.
        </p>
      </div>
    </div>
  );
}

/**
 * Document-level "still working" state. Used while the local Y.Doc is being
 * rehydrated from IndexedDB and the first sync round-trip is still in
 * flight, so the canvas is never a blank hole.
 */
export function EditorBootingState({ visible }: { visible: boolean }) {
  const [dots, setDots] = useState(0);
  useEffect(() => {
    if (!visible) return;
    const interval = window.setInterval(
      () => setDots((n) => (n + 1) % 4),
      400,
    );
    return () => window.clearInterval(interval);
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      aria-live="polite"
      className="flex items-center justify-center gap-2.5 border-b border-border bg-muted/40 px-4 py-2 text-[11px] font-medium text-muted-foreground sm:px-6"
    >
      <Loader2 aria-hidden className="size-3.5 animate-spin" />
      Opening local document
      <span aria-hidden className="tracking-widest">
        {".".repeat(dots)}
      </span>
    </div>
  );
}
