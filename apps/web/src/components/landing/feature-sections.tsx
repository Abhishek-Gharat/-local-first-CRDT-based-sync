import {
  ArrowRight,
  CloudOff,
  GitCommitVertical,
  History,
  Lock,
  ShieldCheck,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import { StatusDot } from "@/components/ui/status-dot";
import { cn } from "@/lib/utils";

/**
 * Marketing sections.
 *
 * Each capability gets its own composed band with a *demonstration* of the
 * mechanism rather than a paragraph asserting it — the previous landing page
 * used six identical icon cards, which gave the reader no way to tell the
 * three hard guarantees (offline, convergence, reversibility) apart from the
 * three commodity ones (fast, AI, access control).
 */

function Section({
  id,
  eyebrow,
  title,
  lede,
  children,
  flip = false,
}: {
  id: string;
  eyebrow: string;
  title: string;
  lede: string;
  children: React.ReactNode;
  flip?: boolean;
}) {
  return (
    <section
      id={id}
      className={cn(
        "border-b border-border scroll-mt-16",
        flip ? "bg-muted/25" : "bg-background",
      )}
    >
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-14">
          <div className={cn(flip && "lg:order-2")}>
            <p className="text-[11px] font-semibold tracking-wide text-primary uppercase">
              {eyebrow}
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-balance text-foreground sm:text-3xl">
              {title}
            </h2>
            <p className="mt-3.5 max-w-lg text-sm leading-relaxed text-pretty text-muted-foreground">
              {lede}
            </p>
          </div>
          <div className={cn(flip && "lg:order-1")}>{children}</div>
        </div>
      </div>
    </section>
  );
}

function Panel({
  title,
  caption,
  children,
  icon: Icon,
}: {
  title: string;
  caption: string;
  children: React.ReactNode;
  icon: LucideIcon;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-lg shadow-foreground/5">
      <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3.5 py-2.5">
        <span className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon aria-hidden className="size-3" />
        </span>
        <p className="text-[11px] font-semibold tracking-tight">{title}</p>
        <span className="ml-auto font-mono text-[9px] text-muted-foreground">
          {caption}
        </span>
      </div>
      <div className="p-3.5">{children}</div>
    </div>
  );
}

/* ── Collaboration ─────────────────────────────────────────────────── */

export function CollaborationSection() {
  const replicas = [
    {
      name: "Your browser",
      state: "syncing" as const,
      text: "edit committed locally, then broadcast",
      clock: "10:41:02",
    },
    {
      name: "Priya's browser",
      state: "online" as const,
      text: "delta received, merged into local state",
      clock: "10:41:02",
    },
    {
      name: "Jonas (offline)",
      state: "offline" as const,
      text: "queued on device, flushes on reconnect",
      clock: "10:40:58",
    },
  ];

  return (
    <Section
      id="collaboration"
      eyebrow="Collaboration"
      title="No locks, no conflict dialogs, no lost keystrokes"
      lede="A conflict-free replicated data type gives every replica the same merge rules. Because merging is commutative, the order updates arrive in cannot change the result — so nobody has to reconcile anything, and there is no last-write-wins window where someone's paragraph silently disappears."
    >
      <Panel
        icon={Users}
        title="Replicas converging on one state"
        caption="yjs · websocket"
      >
        <ul className="flex flex-col gap-2">
          {replicas.map((replica) => (
            <li
              key={replica.name}
              className="flex items-center gap-3 rounded-lg border border-border bg-muted/25 px-3 py-2.5"
            >
              <StatusDot status={replica.state} className="size-2" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-foreground">
                  {replica.name}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {replica.text}
                </p>
              </div>
              <span className="shrink-0 font-mono text-[10px] text-muted-foreground tabular-nums">
                {replica.clock}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-[11px] text-muted-foreground">
          <ArrowRight aria-hidden className="size-3 shrink-0 text-primary" />
          State vectors are exchanged on connect; only the missing deltas cross
          the wire.
        </div>
      </Panel>
    </Section>
  );
}

/* ── Offline / local-first ─────────────────────────────────────────── */

export function OfflineSection() {
  return (
    <Section
      id="offline"
      eyebrow="Local-first"
      title="The network is an optimisation, not a dependency"
      lede="Your document is a CRDT held in the browser and persisted to IndexedDB. Opening, editing and closing a document never waits on a request, so typing latency is local disk speed rather than round-trip time. When the connection drops mid-session, queued versions and unsent updates survive and reconcile on reconnect."
      flip
    >
      <Panel icon={CloudOff} title="Editing with the network disabled" caption="offline-safe">
        <div className="space-y-2.5">
          {[
            { label: "Keystroke applied to local Y.Doc", state: "ok" },
            { label: "Committed to IndexedDB", state: "ok" },
            { label: "Broadcast queued (no socket)", state: "queued" },
            { label: "Version checkpoint queued locally", state: "queued" },
          ].map((step) => (
            <div
              key={step.label}
              className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/25 px-3 py-2"
            >
              <span
                aria-hidden
                className={cn(
                  "flex size-4 items-center justify-center rounded-full text-[9px] font-semibold",
                  step.state === "ok"
                    ? "bg-success/15 text-success"
                    : "bg-warning/15 text-warning",
                )}
              >
                {step.state === "ok" ? "✓" : "⏱"}
              </span>
              <span className="min-w-0 flex-1 truncate text-[11px] text-foreground">
                {step.label}
              </span>
              <span
                className={cn(
                  "shrink-0 font-mono text-[9px] uppercase",
                  step.state === "ok" ? "text-success" : "text-warning",
                )}
              >
                {step.state}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-warning/25 bg-warning/10 px-3 py-2">
          <StatusDot status="syncing" />
          <p className="text-[11px] text-foreground">
            On reconnect, queued updates merge in either direction — no
            operation is discarded.
          </p>
        </div>
      </Panel>
    </Section>
  );
}

/* ── Version history ───────────────────────────────────────────────── */

export function HistorySection() {
  return (
    <Section
      id="history"
      eyebrow="Version history"
      title="Restoring is an edit forward, not a rollback"
      lede="Checkpoints are append-only snapshots, and a restore applies the old state as a new forward edit. Nothing in the history table is ever updated or deleted, so a collaborator who kept working is not overwritten out of existence — the CRDT converges them onto the restored state instead."
    >
      <Panel icon={History} title="Restoring v2 as a new edit" caption="append-only">
        <ol className="relative space-y-2.5">
          <span
            aria-hidden
            className="absolute top-4 bottom-4 left-[7px] w-px bg-border"
          />
          {[
            { v: "v3", note: "current draft", tone: "muted" as const },
            { v: "v2", note: "selected for restore", tone: "primary" as const },
            { v: "v1", note: "preserved", tone: "muted" as const },
          ].map((point) => (
            <li key={point.v} className="relative flex items-center gap-3 pl-6">
              <span
                aria-hidden
                className={cn(
                  "absolute top-1.5 left-0 flex size-3.5 items-center justify-center rounded-full ring-4 ring-card",
                  point.tone === "primary"
                    ? "bg-primary"
                    : "border border-border-strong bg-muted-foreground/40",
                )}
              >
                {point.tone === "primary" && (
                  <span className="size-1.5 rounded-full bg-primary-foreground" />
                )}
              </span>
              <span
                className={cn(
                  "rounded-md px-1.5 py-0.5 font-mono text-[10px] font-semibold",
                  point.tone === "primary"
                    ? "bg-primary/12 text-primary"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {point.v}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {point.note}
              </span>
              {point.tone === "primary" && (
                <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-medium text-primary">
                  <GitCommitVertical aria-hidden className="size-2.5" />
                  new forward edit
                </span>
              )}
            </li>
          ))}
        </ol>
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Lock aria-hidden className="size-3 shrink-0" />
          The versions table grants insert and select only — no update, no
          delete, for any role.
        </p>
      </Panel>
    </Section>
  );
}

/* ── AI summary ────────────────────────────────────────────────────── */

export function AiSection() {
  return (
    <Section
      id="ai"
      eyebrow="Change summaries"
      title="AI that tells you what changed — and admits when it didn&rsquo;t write it"
      lede="Compare any checkpoint against the live document and get a written summary plus deterministic word-level statistics. The provider is chosen by environment variable, and when no key is configured the feature degrades to the algorithmic summary and labels it as such, rather than passing a canned sentence off as model output."
      flip
    >
      <Panel icon={Sparkles} title="Summary of changes since v2" caption="provider-swappable">
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
              <Sparkles aria-hidden className="size-2.5" />
              AI summary
            </span>
            <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
              <span className="text-success">+48</span> /{" "}
              <span className="text-destructive">−12</span> words
            </span>
          </div>
          <p className="text-xs leading-relaxed text-foreground/90">
            Added a section on state-vector reconciliation and clarified that
            merges are order-independent. The old last-write-wins paragraph was
            removed.
          </p>
        </div>
        <div className="mt-2.5 rounded-lg border border-dashed border-border p-3">
          <div className="mb-1.5 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              <Sparkles aria-hidden className="size-2.5" />
              Word-count summary
            </span>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            +48 / −12 words across 7 changed lines.
          </p>
          <p className="mt-1.5 text-[10px] text-muted-foreground/80">
            Shown because no AI provider is configured — never presented as
            model output.
          </p>
        </div>
      </Panel>
    </Section>
  );
}

/* ── Security ──────────────────────────────────────────────────────── */

export function SecuritySection() {
  return (
    <Section
      id="security"
      eyebrow="Access control"
      title="Roles are enforced where the data is, not where the button is"
      lede="A viewer who tampers with the contenteditable flag still cannot write: the sync-server rejects viewer frames on the WebSocket, and PostgreSQL row-level security scopes every read behind a per-request session variable that the app only ever sets as a non-superuser role."
    >
      <div className="grid gap-3">
        {[
          {
            icon: ShieldCheck,
            title: "Handshake and per-message checks",
            body: "The HMAC-signed token states the role once, and the server re-validates it on every frame rather than trusting the initial connection.",
          },
          {
            icon: Lock,
            title: "Row-level security",
            body: "The runtime app connects as a restricted role that is genuinely subject to its policies — migrations use a separate superuser connection.",
          },
          {
            icon: CloudOff,
            title: "Hardened realtime channel",
            body: "Oversized frames are rejected by size before they can buffer, and a malformed client cannot take the server down for everyone else.",
          },
        ].map((item) => (
          <div
            key={item.title}
            className="flex items-start gap-3 rounded-xl border border-border bg-card p-4"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary ring-1 ring-primary/15">
              <item.icon aria-hidden className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{item.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {item.body}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
