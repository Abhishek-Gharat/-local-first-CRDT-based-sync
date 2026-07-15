import Link from "next/link";
import { redirect } from "next/navigation";
import { CloudOff, History, Users, ShieldCheck } from "lucide-react";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";

const FEATURES = [
  {
    icon: CloudOff,
    title: "Works offline",
    body: "Your document lives in your browser. Open, edit, and close it with no connection — changes sync when you're back.",
  },
  {
    icon: Users,
    title: "Real-time collaboration",
    body: "Everyone types into the same CRDT. Concurrent edits merge deterministically — no one's work is ever overwritten.",
  },
  {
    icon: History,
    title: "Version history",
    body: "Snapshot any moment and time-travel back. Restores are new forward edits, so history is never rewritten.",
  },
  {
    icon: ShieldCheck,
    title: "Access control",
    body: "Owner, editor, and viewer roles enforced at the wire level and backed by Postgres row-level security.",
  },
];

export default async function Home() {
  const session = await auth();
  if (session?.user?.id) redirect("/documents");

  return (
    <main className="flex flex-1 flex-col">
      {/* hero */}
      <section className="mx-auto flex w-full max-w-5xl flex-col items-center gap-6 px-4 pt-20 pb-16 text-center sm:px-6 sm:pt-28">
        <span className="rounded-full border border-border bg-muted/50 px-3 py-1 text-xs text-muted-foreground">
          Local-first · CRDT-powered · Zero data loss
        </span>
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Write together, even when the network won&apos;t cooperate
        </h1>
        <p className="max-w-xl text-base text-muted-foreground text-balance sm:text-lg">
          A collaborative document editor that treats your device as the source
          of truth — edits land instantly, sync in the background, and merge
          without conflicts.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" nativeButton={false} render={<Link href="/register">Start writing — it&apos;s free</Link>} />
          <Button
            variant="outline"
            size="lg"
            nativeButton={false}
            render={<Link href="/login">Sign in</Link>}
          />
        </div>
      </section>

      {/* feature grid */}
      <section aria-label="Features" className="mx-auto w-full max-w-5xl px-4 pb-20 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="flex flex-col gap-2.5 rounded-xl border border-border bg-card p-5"
            >
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon aria-hidden className="size-4.5" />
              </span>
              <h2 className="text-sm font-medium">{title}</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
