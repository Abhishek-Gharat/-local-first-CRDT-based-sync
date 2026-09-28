"use client";

import { useEffect, useState } from "react";
import { CloudOff, Eye, Loader2, Radio } from "lucide-react";
import type { ConnectionStatus as Status } from "@/lib/sync/sync-engine";
import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/ui/status-dot";
import { cn } from "@/lib/utils";

/**
 * Fixed corner network status pill / button.
 *
 * Rendered with `fixed bottom-10 right-4 z-40` so it NEVER shifts the
 * document canvas, layout height, or causes layout jumps during network
 * transitions (offline, reconnecting, syncing).
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
  const [dismissedConflict, setDismissedConflict] = useState(false);

  useEffect(() => {
    if (status === "conflict-resolved") {
      setDismissedConflict(false);
      const timer = window.setTimeout(() => setDismissedConflict(true), 5000);
      return () => window.clearTimeout(timer);
    }
  }, [status]);

  if (!offline && status !== "syncing" && (status !== "conflict-resolved" || dismissedConflict)) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-10 right-4 z-40 flex max-w-sm items-center gap-2 rounded-full border border-border/80 bg-background/95 px-3 py-1.5 text-xs text-foreground shadow-lg backdrop-blur-md transition-all duration-200 animate-in fade-in slide-in-from-bottom-2 sm:right-6"
    >
      {offline ? (
        <>
          <CloudOff aria-hidden className="size-3.5 shrink-0 text-warning" />
          <span className="font-medium text-foreground">Offline — saving locally</span>
          {onRetry && (
            <Button
              variant="outline"
              size="xs"
              onClick={onRetry}
              className="ml-1 h-5.5 rounded-full px-2 text-[11px] font-medium"
            >
              Retry
            </Button>
          )}
        </>
      ) : status === "syncing" ? (
        <>
          <Loader2 aria-hidden className="size-3.5 shrink-0 animate-spin text-primary" />
          <span className="font-medium text-muted-foreground">
            Reconnecting & syncing…
          </span>
        </>
      ) : (
        <>
          <Radio aria-hidden className="size-3.5 shrink-0 text-info" />
          <span className="truncate text-muted-foreground">
            Concurrent edits merged
          </span>
        </>
      )}
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
