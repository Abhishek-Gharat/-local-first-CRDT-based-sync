"use client";

import { useState } from "react";
import {
  Clock,
  FileText,
  FolderOpen,
  History,
  LayoutGrid,
  Lock,
  Rows3,
  Search,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
  Check,
  X,
  type LucideIcon,
} from "lucide-react";
import { Kbd } from "@/components/ui/kbd";
import { StatusDot } from "@/components/ui/status-dot";
import { Wordmark } from "@/components/shell/wordmark";
import { ROLE_TONE } from "@/components/workspace/document-item";
import { getCollaboratorColor, getInitials } from "@/lib/collaboration/collaborator-colors";
import { cn } from "@/lib/utils";

/**
 * Product preview.
 *
 * Deliberately *not* a screenshot or a hand-drawn mock: every panel below is
 * assembled from the same primitives the real application renders (the
 * sidebar item pattern, the document row pattern, `RolePill`, `StatusDot`,
 * the app-bar controls, the version-history timeline). That is the only way a
 * marketing preview stays honest as the product changes — and it is why the
 * tabs below switch real compositions rather than swapping images.
 */

type PreviewTab = "workspace" | "collaboration" | "history" | "security";

const TABS: { id: PreviewTab; label: string; icon: LucideIcon }[] = [
  { id: "workspace", label: "Workspace", icon: LayoutGrid },
  { id: "collaboration", label: "Live editing", icon: Users },
  { id: "history", label: "Version history", icon: History },
  { id: "security", label: "Access control", icon: ShieldCheck },
];

export function ProductPreview() {
  const [tab, setTab] = useState<PreviewTab>("workspace");

  return (
    <div className="relative">
      {/* Ambient glow — sits behind the frame, adds depth without a heavy
          drop shadow that would fight the light theme. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-8 -top-10 bottom-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_0%,color-mix(in_oklch,var(--primary)_18%,transparent),transparent_70%)]"
      />

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-foreground/10">
        {/* ── Chrome + tabs ─────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-3 border-b border-border bg-muted/40 px-3 py-2.5 sm:px-4">
          <div className="flex items-center gap-2">
            <Wordmark className="size-5.5" />
            <span className="font-mono text-[11px] font-medium text-muted-foreground">
              docsync
            </span>
          </div>

          <nav
            aria-label="Product preview"
            className="ml-auto flex flex-wrap items-center gap-0.5 rounded-lg border border-border bg-background p-0.5"
          >
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                aria-pressed={tab === item.id}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
                  tab === item.id
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <item.icon aria-hidden className="size-3" />
                <span className="hidden sm:inline">{item.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* ── Stage ─────────────────────────────────────────────────── */}
        <div className="bg-background">
          {tab === "workspace" && <WorkspaceStage />}
          {tab === "collaboration" && <CollaborationStage />}
          {tab === "history" && <HistoryStage />}
          {tab === "security" && <SecurityStage />}
        </div>
      </div>
    </div>
  );
}

/* ── Reused miniature patterns ────────────────────────────────────── */

function PreviewRail() {
  const items = [
    { icon: FileText, label: "All documents", count: 12, active: true },
    { icon: FolderOpen, label: "Owned by me", count: 8 },
    { icon: Users, label: "Shared with me", count: 4 },
  ];
  return (
    <div className="flex w-44 shrink-0 flex-col border-r border-border bg-sidebar px-2.5 py-3 sm:w-52">
      <div className="mb-3 flex items-center gap-2 px-1">
        <span
          aria-hidden
          className="flex size-4.5 items-center justify-center rounded bg-primary/12 text-[8px] font-semibold text-primary"
        >
          AG
        </span>
        <span className="truncate text-[11px] font-medium">Personal</span>
      </div>
      {items.map((item) => (
        <span
          key={item.label}
          className={cn(
            "relative flex h-7 items-center gap-2 rounded-md px-2 text-[11px] font-medium",
            item.active
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-muted-foreground",
          )}
        >
          {item.active && (
            <span
              aria-hidden
              className="absolute top-1/2 -left-2.5 h-3.5 w-0.5 -translate-y-1/2 rounded-r-full bg-primary"
            />
          )}
          <item.icon
            aria-hidden
            className={cn(
              "size-3.5 shrink-0",
              item.active ? "text-primary" : "text-muted-foreground/80",
            )}
          />
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          <span
            className={cn(
              "rounded-full px-1.5 text-[9px] font-semibold tabular-nums",
              item.active ? "bg-primary/12 text-primary" : "bg-muted",
            )}
          >
            {item.count}
          </span>
        </span>
      ))}
      <div className="mt-4 border-t border-border pt-3">
        <p className="px-2 text-[9px] font-medium tracking-wide text-muted-foreground/80 uppercase">
          Capabilities
        </p>
        <span className="mt-1.5 flex h-7 items-center gap-2 rounded-md px-2 text-[11px] font-medium text-muted-foreground">
          <Sparkles aria-hidden className="size-3.5 shrink-0 opacity-80" />
          AI summaries
        </span>
      </div>
    </div>
  );
}

function PreviewAvatar({
  name,
  email,
  self,
  ring,
}: {
  name: string;
  email: string;
  self?: boolean;
  ring?: boolean;
}) {
  return (
    <span
      title={name}
      style={{
        backgroundColor: getCollaboratorColor(email),
        ...(ring ? { boxShadow: `0 0 0 1px ${getCollaboratorColor(email)}` } : {}),
      }}
      className={cn(
        "flex size-5 items-center justify-center rounded-full text-[8px] font-semibold text-white ring-2 ring-background",
        self && "ring-offset-1",
      )}
    >
      {getInitials(name)}
    </span>
  );
}

function MiniDocRow({
  title,
  role,
  owner,
  updated,
  versions,
  active,
}: {
  title: string;
  role: keyof typeof ROLE_TONE;
  owner: string;
  updated: string;
  versions: number;
  active?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-2.5 py-2",
        active ? "bg-muted/70" : "",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-md border",
          active
            ? "border-primary/30 bg-primary/8 text-primary"
            : "border-border bg-card text-muted-foreground",
        )}
      >
        <FileText className="size-3" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[11px] font-medium">{title}</span>
          <span
            className={cn(
              "inline-flex shrink-0 rounded-full px-1.5 py-px text-[8px] font-medium ring-1 ring-inset",
              ROLE_TONE[role].className,
            )}
          >
            {ROLE_TONE[role].label}
          </span>
        </span>
        <span className="block truncate text-[9px] text-muted-foreground">
          {owner} · {updated}
        </span>
      </span>
      <span className="hidden shrink-0 items-center gap-1 text-[9px] text-muted-foreground sm:flex">
        <History aria-hidden className="size-2.5" />
        <span className="tabular-nums">{versions}</span>
      </span>
    </div>
  );
}

function MiniToolbar() {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-border bg-card px-1.5 py-1">
      <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-foreground">
        <Rows3 aria-hidden className="size-2.5 text-primary" />
        Paragraph
      </span>
      <span aria-hidden className="h-3 w-px bg-border" />
      {["B", "I", "S", "</>"].map((glyph) => (
        <span
          key={glyph}
          className="flex size-5 items-center justify-center rounded text-[9px] text-muted-foreground"
        >
          {glyph}
        </span>
      ))}
      <span aria-hidden className="h-3 w-px bg-border" />
      {["•", "1.", "❝"].map((glyph) => (
        <span
          key={glyph}
          className="flex size-5 items-center justify-center rounded text-[9px] text-muted-foreground"
        >
          {glyph}
        </span>
      ))}
    </div>
  );
}

/* ── Stages ────────────────────────────────────────────────────────── */

function WorkspaceStage() {
  return (
    <div className="flex min-h-88">
      <div className="hidden sm:flex">
        <PreviewRail />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        {/* workspace header */}
        <div className="border-b border-border px-3 py-3 sm:px-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold tracking-tight">Documents</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                12 documents · 34 saved versions
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="flex h-6 items-center gap-1.5 rounded-md border border-input px-2 text-[10px] text-muted-foreground">
                <Search aria-hidden className="size-2.5" />
                <span className="hidden sm:inline">Search documents</span>
                <Kbd className="ml-1 h-3.5 text-[8px]">⌘K</Kbd>
              </span>
              <span className="inline-flex h-6 items-center gap-1 rounded-md bg-primary px-2 text-[10px] font-medium text-primary-foreground">
                <FileText aria-hidden className="size-2.5" />
                <span className="hidden sm:inline">New document</span>
              </span>
            </div>
          </div>

          {/* stat strip */}
          <div className="mt-3 grid grid-cols-4 gap-px overflow-hidden rounded-lg border border-border bg-border">
            {[
              { label: "Total", value: 12, active: true },
              { label: "Owned", value: 8 },
              { label: "Shared", value: 4 },
              { label: "Versions", value: 34 },
            ].map((tile) => (
              <div
                key={tile.label}
                className={cn(
                  "bg-card px-2 py-1.5",
                  tile.active && "bg-accent",
                )}
              >
                <p className="text-[9px] font-medium text-muted-foreground">
                  {tile.label}
                </p>
                <p className="mt-0.5 text-sm leading-none font-semibold tabular-nums">
                  {tile.value}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* grouped rows */}
        <div className="flex-1 space-y-3 p-3 sm:p-4">
          <div>
            <p className="mb-1.5 flex items-baseline gap-2 px-1 text-[9px] font-semibold tracking-wide uppercase">
              Today <span className="font-normal text-muted-foreground/70">Edited in the last 24 hours</span>
              <span className="ml-auto text-muted-foreground/70">3</span>
            </p>
            <div className="rounded-lg border border-border bg-card p-1">
              <MiniDocRow
                title="Platform architecture"
                role="owner"
                owner="Owned by you"
                updated="2 min ago"
                versions={7}
                active
              />
              <MiniDocRow
                title="Q3 roadmap"
                role="editor"
                owner="Owned by you"
                updated="1 hour ago"
                versions={4}
              />
            </div>
          </div>
          <div>
            <p className="mb-1.5 flex items-baseline gap-2 px-1 text-[9px] font-semibold tracking-wide uppercase">
              Earlier this week{" "}
              <span className="font-normal text-muted-foreground/70">Edited in the last 7 days</span>
            </p>
            <div className="rounded-lg border border-border bg-card p-1">
              <MiniDocRow
                title="Hiring loop feedback"
                role="viewer"
                owner="Owned by Priya"
                updated="yesterday"
                versions={11}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CollaborationStage() {
  return (
    <div className="min-h-88 p-3 sm:p-4">
      {/* shared app bar */}
      <div className="mb-3 flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5">
        <span className="flex size-5 items-center justify-center rounded-md border border-border text-muted-foreground">
          <FileText aria-hidden className="size-2.5" />
        </span>
        <span className="truncate text-[11px] font-medium">
          Platform architecture
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="flex -space-x-1.5">
            <PreviewAvatar name="Abhishek Gharat" email="ag@example.com" self ring />
            <PreviewAvatar name="Priya Nair" email="pn@example.com" />
            <PreviewAvatar name="Jonas Deen" email="jd@example.com" />
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-success/25 bg-success/10 px-1.5 py-0.5 text-[9px] font-medium">
            <StatusDot status="online" />
            Connected
          </span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {[
          { name: "Abhishek Gharat", email: "ag@example.com", color: "#2563eb", self: true },
          { name: "Priya Nair", email: "pn@example.com", color: "#7c3aed" },
        ].map((person) => (
          <div
            key={person.email}
            className="rounded-xl border border-border bg-canvas p-3"
          >
            <div className="mb-2 flex items-center gap-1.5">
              <PreviewAvatar name={person.name} email={person.email} self={person.self} />
              <span className="text-[10px] font-medium text-muted-foreground">
                {person.self ? "You" : person.name}
              </span>
            </div>
            <p className="text-[11px] font-semibold tracking-tight">
              Sync protocol notes
            </p>
            <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">
              Every keystroke is a CRDT operation applied to the local document
              first, then broadcast as a state-vector diff.
              {person.self ? (
                <>
                  <span
                    className="ml-1 inline-block h-3.5 w-px align-middle"
                    style={{ backgroundColor: person.color }}
                  />
                </>
              ) : null}
            </p>
            {person.self && (
              <div className="mt-2 flex items-center gap-1.5 rounded-md border border-info/25 bg-info/10 px-2 py-1 text-[9px] text-info">
                <StatusDot status="conflict-resolved" />
                Concurrent edits merged automatically
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function HistoryStage() {
  const checkpoints = [
    { v: "v3", when: "4 min ago", who: "Priya Nair", email: "pn@example.com", latest: true, ai: true },
    { v: "v2", when: "2 hours ago", who: "Abhishek Gharat", email: "ag@example.com" },
    { v: "v1", when: "yesterday", who: "Abhishek Gharat", email: "ag@example.com" },
  ];

  return (
    <div className="flex min-h-88">
      <div className="hidden flex-1 flex-col border-r border-border sm:flex">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <span className="flex size-5 items-center justify-center rounded-md border border-border text-muted-foreground">
            <FileText aria-hidden className="size-2.5" />
          </span>
          <span className="truncate text-[11px] font-medium">Platform architecture</span>
        </div>
        <div className="flex-1 space-y-3 p-3">
          <MiniToolbar />
          <div className="space-y-1.5">
            <p className="text-xs font-semibold tracking-tight">Sync protocol notes</p>
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              State vectors describe what a replica already has, so the wire
              only ever carries the delta.
            </p>
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              Merges are commutative and associative, so arrival order cannot
              change the result.
            </p>
          </div>
        </div>
      </div>

      {/* timeline panel */}
      <div className="w-full max-w-72 shrink-0">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
          <span className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary">
            <History aria-hidden className="size-3" />
          </span>
          <div>
            <p className="text-[11px] font-semibold tracking-tight">
              Version history
            </p>
            <p className="text-[9px] text-muted-foreground">
              3 checkpoints · newest first
            </p>
          </div>
        </div>

        <ol className="relative space-y-2.5 p-3">
          <span
            aria-hidden
            className="absolute top-5 bottom-5 left-[19px] w-px bg-border"
          />
          {checkpoints.map((point) => (
            <li key={point.v} className="relative pl-6">
              <span
                aria-hidden
                className={cn(
                  "absolute top-2.5 left-0 flex size-3.5 items-center justify-center rounded-full ring-4 ring-card",
                  point.latest
                    ? "bg-primary"
                    : "border border-border-strong bg-muted-foreground/40",
                )}
              >
                {point.latest && (
                  <span className="size-1.5 rounded-full bg-primary-foreground" />
                )}
              </span>
              <div
                className={cn(
                  "rounded-lg border p-2",
                  point.latest
                    ? "border-primary/25 bg-primary/[0.03]"
                    : "border-border bg-card",
                )}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "rounded px-1 py-px font-mono text-[9px] font-semibold",
                      point.latest
                        ? "bg-primary/12 text-primary"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {point.v}
                  </span>
                  <span className="flex items-center gap-1 text-[9px] text-muted-foreground">
                    <Clock aria-hidden className="size-2" />
                    {point.when}
                  </span>
                </div>
                <p className="mt-1 flex items-center gap-1.5 text-[9px] text-muted-foreground">
                  <PreviewAvatar name={point.who} email={point.email} />
                  {point.who}
                </p>
                {point.ai && (
                  <div className="mt-1.5 rounded-md border border-border bg-muted/30 p-1.5">
                    <div className="mb-1 flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-1 py-px text-[8px] font-medium text-primary">
                        <Sparkles aria-hidden className="size-2" />
                        AI summary
                      </span>
                      <span className="font-mono text-[8px] text-muted-foreground">
                        <span className="text-success">+48</span> /{" "}
                        <span className="text-destructive">−12</span> words
                      </span>
                    </div>
                    <p className="text-[9px] leading-snug text-foreground/90">
                      Added a section on state-vector reconciliation and
                      clarified that merges are order-independent.
                    </p>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

const ACCESS_MATRIX = [
  { capability: "Read the document", owner: true, editor: true, viewer: true },
  { capability: "Edit and sync changes", owner: true, editor: true, viewer: false },
  { capability: "Save and restore versions", owner: true, editor: true, viewer: false },
  { capability: "Invite and change roles", owner: true, editor: false, viewer: false },
];

function SecurityStage() {
  return (
    <div className="min-h-88 p-3 sm:p-4">
      <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
        {/* access matrix */}
        <div className="rounded-xl border border-border">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
            <ShieldCheck aria-hidden className="size-3.5 text-primary" />
            <p className="text-[11px] font-semibold tracking-tight">
              Enforced capabilities
            </p>
            <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-success/25 bg-success/10 px-1.5 py-0.5 text-[9px] font-medium text-success">
              <StatusDot status="online" />
              Wire-level
            </span>
          </div>
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border text-[9px] tracking-wide text-muted-foreground uppercase">
                <th scope="col" className="px-3 py-1.5 font-medium">
                  Capability
                </th>
                <th scope="col" className="px-2 py-1.5 text-center font-medium">
                  Owner
                </th>
                <th scope="col" className="px-2 py-1.5 text-center font-medium">
                  Editor
                </th>
                <th scope="col" className="px-2 py-1.5 text-center font-medium">
                  Viewer
                </th>
              </tr>
            </thead>
            <tbody>
              {ACCESS_MATRIX.map((row) => (
                <tr
                  key={row.capability}
                  className="border-b border-border/60 last:border-0"
                >
                  <th
                    scope="row"
                    className="px-3 py-1.5 text-[10px] font-normal text-foreground"
                  >
                    {row.capability}
                  </th>
                  {[row.owner, row.editor, row.viewer].map((allowed, index) => (
                    <td key={index} className="px-2 py-1.5 text-center">
                      {allowed ? (
                        <Check
                          aria-label="Allowed"
                          className="mx-auto size-3 text-success"
                        />
                      ) : (
                        <X
                          aria-label="Denied"
                          className="mx-auto size-3 text-muted-foreground/50"
                        />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* members */}
        <div className="rounded-xl border border-border">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
            <UserPlus aria-hidden className="size-3.5 text-primary" />
            <div>
              <p className="text-[11px] font-semibold tracking-tight">
                Share document
              </p>
              <p className="text-[9px] text-muted-foreground">
                3 people have access
              </p>
            </div>
          </div>
          <div className="space-y-1.5 p-2.5">
            {[
              { name: "Abhishek Gharat", email: "ag@example.com", role: "owner" },
              { name: "Priya Nair", email: "pn@example.com", role: "editor" },
              { name: "Jonas Deen", email: "jd@example.com", role: "viewer" },
            ].map((member) => (
              <div
                key={member.email}
                className="flex items-center gap-2 rounded-lg border border-transparent px-1.5 py-1.5"
              >
                <PreviewAvatar name={member.name} email={member.email} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[10px] font-medium">{member.name}</p>
                  <p className="truncate text-[9px] text-muted-foreground">
                    {member.email}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-1.5 py-px text-[8px] font-medium ring-1 ring-inset",
                    ROLE_TONE[member.role as keyof typeof ROLE_TONE].className,
                  )}
                >
                  {ROLE_TONE[member.role as keyof typeof ROLE_TONE].label}
                </span>
              </div>
            ))}
          </div>
          <div className="flex items-start gap-1.5 border-t border-border bg-muted/40 px-3 py-2">
            <Lock aria-hidden className="mt-px size-2.5 shrink-0 text-muted-foreground" />
            <p className="text-[9px] leading-snug text-muted-foreground">
              Row-level security in Postgres and the sync-server message guard
              both enforce these roles.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
