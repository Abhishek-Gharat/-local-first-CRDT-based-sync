import {
  FileX,
  ShieldAlert,
  TriangleAlert,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ErrorKind = "offline" | "not-found" | "forbidden" | "generic";

const COPY: Record<
  ErrorKind,
  { icon: LucideIcon; title: string; body: string; retry: boolean }
> = {
  offline: {
    icon: WifiOff,
    title: "You are offline",
    body: "docsync needs a connection to reach the server for the first time. Once a document is open, editing continues offline and syncs on reconnect.",
    retry: true,
  },
  "not-found": {
    icon: FileX,
    title: "Document not found",
    body: "This document may have been deleted, or the link is incomplete. If you followed a share link, ask the owner to send it again.",
    retry: false,
  },
  forbidden: {
    icon: ShieldAlert,
    title: "You do not have access",
    body: "Your account is not a member of this document. Ask the owner to invite you, then reload the page.",
    retry: false,
  },
  generic: {
    icon: TriangleAlert,
    title: "Something went wrong",
    body: "The page hit an unexpected error. Retrying usually clears it — and if it keeps happening, your document is still safe on the server.",
    retry: true,
  },
};

interface ErrorStateProps {
  kind?: ErrorKind;
  title?: string;
  body?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
  compact?: boolean;
  backHref?: string;
  backLabel?: string;
}

/**
 * Shared failure surface. One component decides the icon, tone and wording
 * for every failure mode in the product (offline / missing / forbidden /
 * crash) instead of each page writing its own two-line apology.
 */
export function ErrorState({
  kind = "generic",
  title,
  body,
  onRetry,
  retryLabel = "Try again",
  className,
  compact = false,
  backHref = "/documents",
  backLabel = "Back to documents",
}: ErrorStateProps) {
  const copy = COPY[kind];
  const Icon = copy.icon;
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-border bg-card text-center",
        compact ? "gap-3 px-5 py-7" : "gap-4 px-6 py-14",
        className,
      )}
    >
      <span
        aria-hidden
        className="flex size-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive ring-1 ring-destructive/20"
      >
        <Icon className="size-5" />
      </span>
      <div className="max-w-sm space-y-1.5">
        <p className="text-sm font-semibold tracking-tight text-foreground">
          {title ?? copy.title}
        </p>
        <p className="text-xs leading-relaxed text-balance text-muted-foreground">
          {body ?? copy.body}
        </p>
      </div>
      <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
        {onRetry && copy.retry && (
          <Button size="sm" onClick={onRetry} className="font-medium">
            {retryLabel}
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          nativeButton={false}
          render={
            <a href={backHref} className="font-medium">
              {backLabel}
            </a>
          }
        />
      </div>
    </div>
  );
}
