import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/shell/wordmark";

/**
 * Closing CTA. Restates the three guarantees as a checklist rather than
 * repeating the hero copy, because by this point the reader has scrolled past
 * the evidence and needs the summary, not the pitch.
 */
export function CtaSection() {
  return (
    <section className="relative overflow-hidden border-b border-border bg-muted/25">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-64 bg-[radial-gradient(50%_100%_at_50%_100%,color-mix(in_oklch,var(--primary)_14%,transparent),transparent)]"
      />
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center px-4 py-20 text-center sm:px-6 sm:py-24">
        <Wordmark className="size-10" />

        <h2 className="mt-6 max-w-2xl text-2xl font-semibold tracking-tight text-balance text-foreground sm:text-4xl">
          Start a document, then turn the network off
        </h2>
        <p className="mt-4 max-w-lg text-sm leading-relaxed text-pretty text-muted-foreground">
          The fastest way to understand a local-first editor is to keep typing
          after the connection drops, then watch both halves reconcile.
        </p>

        <ul className="mt-8 flex flex-col items-start gap-2.5 text-left sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-6">
          {[
            "No server round-trip while typing",
            "Concurrent edits merge, never clobber",
            "Every version restorable, nothing rewritten",
          ].map((item) => (
            <li
              key={item}
              className="flex items-center gap-2 text-xs text-muted-foreground"
            >
              <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
                <Check aria-hidden className="size-2.5" />
              </span>
              {item}
            </li>
          ))}
        </ul>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Button
            size="lg"
            nativeButton={false}
            render={
              <Link href="/register" className="h-10 gap-2 px-4 font-medium">
                Create a free account
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
                I already have one
              </Link>
            }
          />
        </div>
      </div>
    </section>
  );
}
