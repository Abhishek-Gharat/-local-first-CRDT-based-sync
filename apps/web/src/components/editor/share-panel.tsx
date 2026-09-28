"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Crown,
  Info,
  Loader2,
  Lock,
  PenLine,
  Eye,
  UserPlus,
  WifiOff,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { getCollaboratorColor, getInitials } from "@/lib/collaboration/collaborator-colors";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface Member {
  id: string;
  userId: string;
  role: "owner" | "editor" | "viewer";
  email: string;
  name: string;
}

interface SharePanelProps {
  documentId: string;
  /** Rendered in the panel header so the invite flow names what it shares. */
  documentTitle?: string;
  currentUserId?: string;
}

type FeedbackTone = "success" | "warning" | "error";

const ROLE_META = {
  owner: {
    label: "Owner",
    icon: Crown,
    description: "Full control, including sharing and roles",
  },
  editor: {
    label: "Editor",
    icon: PenLine,
    description: "Can edit and sync changes in real time",
  },
  viewer: {
    label: "Viewer",
    icon: Eye,
    description: "Can read; writes are rejected at the wire",
  },
} as const;

const ROLE_ORDER: Record<Member["role"], number> = {
  owner: 0,
  editor: 1,
  viewer: 2,
};

/**
 * Sharing workflow.
 *
 * Sharing is a headline capability, so it is a full panel rather than a
 * popover: who can get in (invite + permission), who already can (the
 * collaborator list with role management and an explicit owner marker), and
 * what the permissions actually mean at the protocol level. The old version
 * was a three-field popover with a native `<select>` and no explanation of
 * what the roles do.
 *
 * The members API is the enforcement point (owner-only POST, RLS-scoped
 * reads) — this component is the front door to it, and role changes reuse the
 * same upsert POST rather than inventing a second endpoint.
 */
export function SharePanel({
  documentId,
  documentTitle,
  currentUserId,
}: SharePanelProps) {
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("editor");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; tone: FeedbackTone } | null>(
    null,
  );

  const loadMembers = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const response = await fetch(`/api/documents/${documentId}/members`);
      if (!response.ok) throw new Error(`members ${response.status}`);
      const body = (await response.json()) as { members: Member[] };
      setMembers(body.members);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    if (!open) return;
    // Deferred to a microtask so the eventual setMembers() call isn't a
    // synchronous cascade off this effect (react-hooks/set-state-in-effect).
    void Promise.resolve().then(loadMembers);
  }, [open, loadMembers]);

  const sorted = [...members].sort(
    (a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.name.localeCompare(b.name),
  );
  const editors = members.filter((m) => m.role !== "viewer").length;

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      const response = await fetch(`/api/documents/${documentId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      if (response.ok) {
        setEmail("");
        setFeedback({ text: `Added ${email} as ${role}.`, tone: "success" });
        await loadMembers();
      } else if (response.status === 404) {
        setFeedback({
          text: `No account exists for ${email} — they need to register first.`,
          tone: "warning",
        });
      } else if (response.status === 403) {
        setFeedback({
          text: "Only the document owner can manage members.",
          tone: "error",
        });
      } else {
        setFeedback({
          text: "Could not add member — check the address and try again.",
          tone: "error",
        });
      }
    } catch {
      setFeedback({
        text: "Could not reach the server — are you offline?",
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(member: Member, next: "editor" | "viewer") {
    if (member.role === next) return;
    setBusy(true);
    setFeedback(null);
    try {
      const response = await fetch(`/api/documents/${documentId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: member.email, role: next }),
      });
      if (response.ok) {
        setFeedback({
          text: `${member.name} is now an ${next}.`,
          tone: "success",
        });
        await loadMembers();
      } else {
        setFeedback({
          text: "Could not change that role.",
          tone: "error",
        });
      }
    } catch {
      setFeedback({ text: "Could not reach the server.", tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            aria-controls="share-panel"
            aria-label="Share"
            className="h-8 gap-1.5 font-medium"
          />
        }
      >
        <UserPlus aria-hidden className="size-3.5" />
        <span className="hidden lg:inline">Share</span>
      </SheetTrigger>

      <SheetContent id="share-panel" side="right" aria-label="Share document">
        <SheetHeader>
          <span
            aria-hidden
            className="mb-1.5 flex size-8 w-fit items-center justify-center rounded-lg bg-primary/10 text-primary"
          >
            <UserPlus className="size-4" />
          </span>
          <div className="min-w-0">
            <SheetTitle>Share document</SheetTitle>
            <SheetDescription className="truncate">
              {documentTitle ? `Invite people to “${documentTitle}”` : "Invite collaborators and manage roles"}
            </SheetDescription>
          </div>
        </SheetHeader>

        <SheetBody className="px-5 py-4">
          {/* Access summary — the question people actually have is
              "who can see this?", answered before they scroll. */}
          <div className="rounded-xl border border-border bg-muted/30 p-3">
            <div className="flex items-center gap-2">
              <ShieldCheck aria-hidden className="size-4 shrink-0 text-primary" />
              <p className="text-xs font-medium text-foreground">
                {loading && members.length === 0
                  ? "Checking who has access…"
                  : `${members.length} ${members.length === 1 ? "person has" : "people have"} access`}
              </p>
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
              {editors} can write, {members.length - editors} can only read.
              Roles are re-checked on every WebSocket frame, not just when the
              document is opened.
            </p>

            <ul className="mt-3 grid gap-1.5">
              {(Object.keys(ROLE_META) as (keyof typeof ROLE_META)[]).map(
                (key) => {
                  const meta = ROLE_META[key];
                  return (
                    <li key={key} className="flex items-start gap-2">
                      <meta.icon
                        aria-hidden
                        className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                      />
                      <p className="text-[11px] leading-snug text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {meta.label}
                        </span>{" "}
                        — {meta.description}
                      </p>
                    </li>
                  );
                },
              )}
            </ul>
          </div>

          {/* Invite */}
          <form onSubmit={handleAdd} className="mt-4 flex flex-col gap-2.5">
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="share-email"
                  className="text-[11px] font-medium text-foreground"
                >
                  Email
                </Label>
                <Input
                  id="share-email"
                  type="email"
                  required
                  placeholder="collaborator@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={busy}
                  className="h-8 text-xs"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="share-role"
                  className="text-[11px] font-medium text-foreground"
                >
                  Role
                </Label>
                <select
                  id="share-role"
                  value={role}
                  onChange={(event) => setRole(event.target.value as "editor" | "viewer")}
                  disabled={busy}
                  className="h-8 rounded-lg border border-input bg-background px-2 text-xs font-medium text-foreground outline-none transition-colors hover:bg-muted/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-50"
                >
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
            </div>
            <Button
              type="submit"
              size="sm"
              disabled={busy || email.trim() === ""}
              className="h-8 justify-center gap-1.5 font-medium"
            >
              {busy ? (
                <>
                  <Loader2 aria-hidden className="size-3.5 animate-spin" />
                  Adding…
                </>
              ) : (
                <>
                  <UserPlus aria-hidden className="size-3.5" />
                  Add
                </>
              )}
            </Button>
          </form>

          {feedback && (
            <p
              role="status"
              aria-live="polite"
              className={cn(
                "mt-3 flex items-start gap-2 rounded-lg border px-2.5 py-2 text-[11px]",
                feedback.tone === "success" &&
                  "border-success/25 bg-success/10 text-foreground",
                feedback.tone === "warning" &&
                  "border-warning/30 bg-warning/10 text-foreground",
                feedback.tone === "error" &&
                  "border-destructive/25 bg-destructive/10 text-destructive",
              )}
            >
              {feedback.tone === "success" ? (
                <ShieldCheck aria-hidden className="mt-px size-3.5 shrink-0 text-success" />
              ) : feedback.tone === "warning" ? (
                <Info aria-hidden className="mt-px size-3.5 shrink-0 text-warning" />
              ) : (
                <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
              )}
              {feedback.text}
            </p>
          )}

          {/* Collaborators */}
          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-[11px] font-semibold tracking-wide text-foreground uppercase">
                People
              </h3>
              {!loading && !loadError && (
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {members.length}
                </span>
              )}
            </div>

            {loading && members.length === 0 ? (
              <ul className="flex flex-col gap-1.5">
                {Array.from({ length: 3 }, (_, index) => (
                  <li
                    key={index}
                    className="flex items-center gap-2.5 rounded-lg border border-border px-2.5 py-2"
                  >
                    <Skeleton className="size-7 shrink-0 rounded-full" />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <Skeleton className="h-3 w-1/3" />
                      <Skeleton className="h-2.5 w-1/2" />
                    </div>
                    <Skeleton className="h-5 w-14 rounded-full" />
                  </li>
                ))}
              </ul>
            ) : loadError ? (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-[11px] text-destructive"
              >
                <WifiOff aria-hidden className="mt-px size-3.5 shrink-0" />
                <span>
                  Could not load the people list. Reload the panel to try again.
                </span>
              </div>
            ) : (
              <ul aria-label="Current members" className="flex flex-col gap-1">
                {sorted.map((member) => {
                  const isOwner = member.role === "owner";
                  const isSelf = member.userId === currentUserId;
                  const color = getCollaboratorColor(member.email || member.name);
                  return (
                    <li
                      key={member.id}
                      className="flex items-center gap-2.5 rounded-lg border border-transparent px-2.5 py-2 transition-colors hover:border-border hover:bg-muted/40"
                    >
                      <span
                        aria-hidden
                        className="flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                        style={{ backgroundColor: color }}
                      >
                        {getInitials(member.name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 truncate text-xs font-medium text-foreground">
                          <span className="truncate">{member.name}</span>
                          {isSelf && (
                            <span className="shrink-0 rounded bg-muted px-1 py-px text-[9px] font-medium text-muted-foreground">
                              you
                            </span>
                          )}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {member.email}
                        </p>
                      </div>

                      {isOwner ? (
                        <>
                          <span className="sr-only">{member.name}&apos;s role</span>
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary ring-1 ring-primary/20 ring-inset">
                            <Crown aria-hidden className="size-2.5" />
                            Owner
                          </span>
                        </>
                      ) : (
                        <>
                          <label className="sr-only" htmlFor={`role-${member.id}`}>
                            {member.name}&apos;s role
                          </label>
                          <select
                            id={`role-${member.id}`}
                            value={member.role}
                            disabled={busy}
                            onChange={(event) =>
                              void changeRole(
                                member,
                                event.target.value as "editor" | "viewer",
                              )
                            }
                            className="h-7 shrink-0 rounded-full border border-border bg-background px-2 text-[10px] font-medium text-muted-foreground capitalize outline-none transition-colors hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-50"
                          >
                            <option value="editor">Editor</option>
                            <option value="viewer">Viewer</option>
                          </select>
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </SheetBody>

        <SheetFooter>
          <Lock aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
          <p className="text-[11px] leading-snug text-muted-foreground">
            Row-level security in Postgres and the sync-server&apos;s message
            guard both enforce these roles — hiding a control is never the
            protection.
          </p>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
