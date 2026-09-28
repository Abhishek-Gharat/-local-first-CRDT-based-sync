import Link from "next/link";
import { Radio } from "lucide-react";
import { Wordmark } from "@/components/shell/wordmark";

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}

/**
 * Split-screen auth layout.
 *
 * The left band sells the guarantee and the right column holds the form, so
 * the form is not floating in the middle of an empty viewport the way a
 * centred card was. Collapses to a single column below `lg`.
 */
export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <main className="flex flex-1 items-stretch">
      <div className="flex w-full flex-col justify-center px-4 py-12 sm:px-8 lg:w-[46%] lg:px-14">
        <div className="mx-auto w-full max-w-sm">
          <Link
            href="/"
            className="inline-flex items-center gap-2.5 rounded-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <Wordmark className="size-7" />
            <span className="text-[15px] font-semibold tracking-tight">docsync</span>
          </Link>

          <h1 className="mt-8 text-2xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>

          <div className="mt-7">{children}</div>

          <div className="mt-6 text-xs text-muted-foreground">{footer}</div>
        </div>
      </div>

      {/* Brand band */}
      <aside className="relative hidden flex-1 overflow-hidden border-l border-border bg-muted/30 lg:flex lg:flex-col lg:justify-center lg:px-14">
        <div aria-hidden className="ds-grid-bg absolute inset-0" />
        <div className="relative max-w-md">
          <p className="inline-flex items-center gap-1.5 rounded-full border border-success/25 bg-success/10 px-2.5 py-1 text-[11px] font-medium text-success">
            <Radio aria-hidden className="size-3" />
            Local-first · CRDT sync · zero data loss
          </p>
          <h2 className="mt-6 text-3xl leading-tight font-semibold tracking-tight text-balance text-foreground">
            Your device holds the source of truth.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Edits commit to the browser before anything touches the network, so
            typing never waits on a round trip. The sync engine reconciles the
            rest in the background.
          </p>
          <ul className="mt-8 space-y-3">
            {[
              "Type with the network switched off",
              "Concurrent edits merge without a conflict dialog",
              "Every checkpoint restorable, nothing rewritten",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-foreground">
                <span
                  aria-hidden
                  className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary"
                />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </main>
  );
}
