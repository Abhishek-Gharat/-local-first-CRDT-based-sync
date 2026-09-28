import { Skeleton } from "@/components/ui/skeleton";

/**
 * Document loading state.
 *
 * Reproduces the real editor chrome — app bar, document identity, metadata
 * rail, sticky toolbar, text column — so the transition into the editor is a
 * settle rather than a re-layout, and so the user can tell the document is
 * being opened rather than failing to open.
 */
export default function DocumentLoading() {
  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-background">
      {/* App bar */}
      <div className="flex h-14 items-center gap-2 border-b border-border px-3 sm:px-4">
        <Skeleton className="size-8 rounded-lg" />
        <Skeleton className="hidden size-6.5 rounded-lg sm:block" />
        <Skeleton className="h-4 w-px" />
        <Skeleton className="size-7 rounded-lg" />
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="hidden h-4 w-14 rounded-full sm:block" />
        </div>
        <div className="hidden items-center gap-2 md:flex">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-6 w-28 rounded-full" />
        </div>
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-8 w-28 rounded-lg" />
          <Skeleton className="h-8 w-20 rounded-lg" />
          <Skeleton className="size-8 rounded-lg" />
        </div>
      </div>

      <div className="flex-1 bg-muted/25">
        <div className="mx-auto w-full max-w-4xl px-3 py-5 sm:px-6 sm:py-8">
          <div className="rounded-2xl border border-border bg-canvas px-4 py-6 shadow-sm sm:px-10 sm:py-9">
            {/* Identity */}
            <div className="border-b border-border pb-4">
              <Skeleton className="h-8 w-2/3" />
              <div className="mt-3 flex items-center gap-4">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-3 w-px" />
                <Skeleton className="h-3 w-28" />
              </div>
            </div>

            {/* Toolbar */}
            <div className="mt-4 flex items-center gap-1.5 rounded-xl border border-border p-1">
              <Skeleton className="h-6 w-24 rounded-md" />
              <Skeleton className="mx-1 h-4 w-px" />
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="size-7 rounded-md" />
              ))}
              <Skeleton className="mx-1 h-4 w-px" />
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="size-7 rounded-md" />
              ))}
            </div>

            {/* Prose */}
            <div className="mt-5 space-y-3">
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-11/12" />
              <Skeleton className="h-3.5 w-4/5" />
              <Skeleton className="mt-6 h-5 w-1/2" />
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-10/12" />
            </div>
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className="flex h-8 items-center border-t border-border px-4 sm:px-6">
        <Skeleton className="h-2.5 w-56" />
      </div>

      <div role="status" aria-live="polite" className="sr-only">
        Opening document
      </div>
    </div>
  );
}
