import Link from "next/link";
import { ArrowRight, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Hero.
 *
 * Asymmetric and left-aligned rather than a centred stack: the headline
 * column carries a fixed measure so it never sprawls on a wide monitor, and
 * the right column holds the three claims that actually differentiate the
 * product (offline, conflict-free, reversible) as a compact ledger instead
 * of a row of identical feature cards.
 */
export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border">
      <div aria-hidden className="ds-grid-bg absolute inset-0 -z-10" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-64 bg-[radial-gradient(50%_100%_at_50%_0%,color-mix(in_oklch,var(--primary)_12%,transparent),transparent)]"
      />

      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 pt-16 pb-14 sm:px-6 sm:pt-24 sm:pb-20 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-border bg-background/70 py-1 pr-3 pl-1.5 text-[11px] font-medium text-muted-foreground backdrop-blur-sm">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
              <Radio aria-hidden className="size-2.5" />
              Live
            </span>
            Local-first · CRDT sync · zero data loss
          </p>

          <h1 className="mt-6 max-w-2xl text-4xl font-semibold tracking-tight text-balance text-foreground sm:text-5xl lg:text-[3.4rem] lg:leading-[1.05]">
            Write together, even when the network
            <span className="text-primary"> won&rsquo;t cooperate</span>
          </h1>

          <p className="mt-5 max-w-xl text-base leading-relaxed text-pretty text-muted-foreground">
            Your browser is the source of truth. Edits land instantly, sync in
            the background through a Yjs CRDT, and merge with concurrent
            collaborator edits without a single conflict dialog.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button
              size="lg"
              nativeButton={false}
              render={
                <Link href="/register" className="h-10 gap-2 px-4 font-medium">
                  Start writing — free
                  <ArrowRight aria-hidden className="size-4" />
                </Link>
              }
            />
            <Button
              variant="outline"
              size="lg"
              nativeButton={false}
              render={
                <Link href="/login" className="h-10 px-4 font-medium">
                  Sign in
                </Link>
              }
            />
            <a
              href="#product"
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              See the interface
              <ArrowRight aria-hidden className="size-3" />
            </a>
          </div>
        </div>

        {/* Differentiator ledger */}
        <dl className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border lg:mb-2">
          {[
            {
              k: "Offline",
              v: "Full editing, no spinner",
              d: "Y.Doc + IndexedDB commit before the network is consulted.",
            },
            {
              k: "Concurrent edits",
              v: "Commutative merge, not last-write-wins",
              d: "State vectors reconcile deltas in either arrival order.",
            },
            {
              k: "History",
              v: "Append-only, restorable",
              d: "Restoring writes a forward edit — no history is rewritten.",
            },
          ].map((item) => (
            <div key={item.k} className="bg-background px-4 py-3.5">
              <dt className="text-[10px] font-semibold tracking-wide text-primary uppercase">
                {item.k}
              </dt>
              <dd>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {item.v}
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                  {item.d}
                </p>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
