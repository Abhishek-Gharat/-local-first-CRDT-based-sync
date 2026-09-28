import { Skeleton } from "@/components/ui/skeleton";

/**
 * Workspace loading state.
 *
 * Mirrors the real layout — header, control bar, stat strip, then recency
 * sections — so the page does not reflow when data lands, and so the wait
 * communicates "a workspace is being assembled" rather than "a spinner is
 * spinning". Every bar is inert (`aria-hidden` via Skeleton) and the whole
 * region announces itself once.
 */
export default function DocumentsLoading() {
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="border-b border-border bg-background/70">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 pt-5 pb-4 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-3 w-44" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-52 rounded-lg" />
              <Skeleton className="h-8 w-32 rounded-lg" />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-8 w-56 rounded-lg" />
            <Skeleton className="h-8 w-56 rounded-lg" />
            <Skeleton className="h-8 w-32 rounded-lg" />
            <Skeleton className="ml-auto h-8 w-16 rounded-lg" />
          </div>

          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="space-y-2 bg-card px-3.5 py-2.5">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-5 w-8" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div
        role="status"
        aria-live="polite"
        className="sr-only"
      >
        Loading your documents
      </div>

      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-5 sm:px-6">
        <div className="flex flex-col gap-7">
          {Array.from({ length: 2 }, (_, section) => (
            <section key={section}>
              <div className="mb-2.5 flex items-center gap-2.5 px-1">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-32" />
              </div>
              <div className="rounded-xl border border-border bg-card p-1">
                {Array.from({ length: section === 0 ? 4 : 3 }, (_, row) => (
                  <div
                    key={row}
                    className="flex items-center gap-3 px-3 py-2.5"
                  >
                    <Skeleton className="size-8 shrink-0 rounded-lg" />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-2/5" />
                      <Skeleton className="h-2.5 w-1/4" />
                    </div>
                    <Skeleton className="hidden h-3 w-24 md:block" />
                    <Skeleton className="hidden h-3 w-24 md:block" />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
