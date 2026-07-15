"use client";

import { useCallback, useEffect, useState } from "react";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Member {
  id: string;
  userId: string;
  role: "owner" | "editor" | "viewer";
  email: string;
  name: string;
}

interface SharePanelProps {
  documentId: string;
}

/**
 * Owner-facing share UI over the existing members API: add a collaborator by
 * email as editor or viewer, and see who already has access. The API is the
 * enforcement point (owner-only POST, RLS-scoped reads) — this component is
 * just the missing front door to it.
 */
export function SharePanel({ documentId }: SharePanelProps) {
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("editor");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadMembers = useCallback(async () => {
    const response = await fetch(`/api/documents/${documentId}/members`);
    if (!response.ok) return;
    const body = (await response.json()) as { members: Member[] };
    setMembers(body.members);
  }, [documentId]);

  useEffect(() => {
    if (!open) return;
    // Deferred to a microtask so the eventual setMembers() call isn't a
    // synchronous cascade off this effect (react-hooks/set-state-in-effect).
    void Promise.resolve().then(loadMembers);
  }, [open, loadMembers]);

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
        setFeedback(`Added ${email} as ${role}.`);
        await loadMembers();
      } else if (response.status === 404) {
        setFeedback(`No account exists for ${email} — they need to register first.`);
      } else if (response.status === 403) {
        setFeedback("Only the document owner can manage members.");
      } else {
        setFeedback("Could not add member — check the email and try again.");
      }
    } catch {
      setFeedback("Could not reach the server — are you offline?");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        aria-expanded={false}
        aria-controls="share-panel"
      >
        <Users aria-hidden />
        Share
      </Button>
    );
  }

  return (
    <section
      id="share-panel"
      aria-label="Share document"
      aria-busy={busy}
      className="flex w-full flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-xs"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">Share</h2>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)} aria-expanded>
          Close
        </Button>
      </div>

      <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-2">
        <div className="flex min-w-48 flex-1 flex-col gap-1">
          <Label htmlFor="share-email">Email</Label>
          <Input
            id="share-email"
            type="email"
            required
            placeholder="collaborator@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={busy}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="share-role">Role</Label>
          {/* native select: fully keyboard/screen-reader accessible without
              pulling in a listbox primitive for a two-option choice */}
          <select
            id="share-role"
            value={role}
            onChange={(event) => setRole(event.target.value as "editor" | "viewer")}
            disabled={busy}
            className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          >
            <option value="editor">editor</option>
            <option value="viewer">viewer</option>
          </select>
        </div>
        <Button type="submit" size="sm" disabled={busy || email.trim() === ""}>
          {busy ? "Adding…" : "Add"}
        </Button>
      </form>

      {feedback && (
        <p role="status" aria-live="polite" className="text-xs text-muted-foreground">
          {feedback}
        </p>
      )}

      {members.length > 0 && (
        <ul aria-label="Current members" className="flex flex-col">
          {members.map((member) => (
            <li
              key={member.id}
              className="flex items-center justify-between gap-2 border-t border-border/60 py-2 text-sm first:border-t-0"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  aria-hidden
                  className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[0.65rem] font-medium text-primary uppercase"
                >
                  {member.name.slice(0, 2)}
                </span>
                <span className="truncate">
                  {member.name}{" "}
                  <span className="text-muted-foreground">({member.email})</span>
                </span>
              </span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground capitalize">
                {member.role}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
