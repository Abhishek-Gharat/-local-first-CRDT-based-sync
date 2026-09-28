"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import {
  CornerDownLeft,
  FileText,
  FolderOpen,
  Plus,
  Search,
  Users,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { StatusDot } from "@/components/ui/status-dot";
import type { DocumentSummary } from "@/lib/workspace/load-documents";
import { cn } from "@/lib/utils";

interface CommandPaletteProps {
  documents: DocumentSummary[];
  onCreateDocument: () => void;
  /** Controlled by the workspace so the header search button can open it. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Command {
  id: string;
  label: string;
  hint?: string;
  keywords: string;
  group: "Documents" | "Navigate" | "Create";
  icon: React.ComponentType<{ className?: string }>;
  run: () => void;
  trailing?: React.ReactNode;
}

/**
 * ⌘K command palette over the user's documents.
 *
 * This is the keyboard-first entry point into the workspace: it is the only
 * surface that can reach *any* document in one keystroke, which is what makes
 * a list-based workspace feel fast once the list grows. Also binds `/` when
 * focus is not already inside a field, so the shortcut is discoverable without
 * reading the hint.
 */
export function CommandPalette({
  documents,
  onCreateDocument,
  open,
  onOpenChange,
}: CommandPaletteProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => {
    onOpenChange(false);
    setQuery("");
    setActiveIndex(0);
  }, [onOpenChange]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenChange(!open);
        return;
      }
      if (event.key === "/" && !typing && !open) {
        event.preventDefault();
        onOpenChange(true);
      }
      if (event.key === "Escape" && open) close();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, close, onOpenChange]);

  const commands = useMemo<Command[]>(() => {
    const docCommands: Command[] = documents.map((doc) => ({
      id: `doc:${doc.id}`,
      label: doc.title,
      hint: `${doc.role} · ${doc.memberCount} member${doc.memberCount === 1 ? "" : "s"}`,
      keywords: `${doc.title} ${doc.ownerName} ${doc.role}`,
      group: "Documents",
      icon: FileText,
      run: () => router.push(`/documents/${doc.id}`),
      trailing:
        doc.versionCount === 0 ? (
          <StatusDot status="syncing" />
        ) : (
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {doc.versionCount} v
          </span>
        ),
    }));

    const navCommands: Command[] = [
      {
        id: "nav:all",
        label: "All documents",
        keywords: "workspace home list",
        group: "Navigate",
        icon: FolderOpen,
        run: () => router.push("/documents"),
      },
      {
        id: "nav:owned",
        label: "Owned by me",
        keywords: "owner my documents",
        group: "Navigate",
        icon: FolderOpen,
        run: () => router.push("/documents?view=owned"),
      },
      {
        id: "nav:shared",
        label: "Shared with me",
        keywords: "collaborators others",
        group: "Navigate",
        icon: Users,
        run: () => router.push("/documents?view=shared"),
      },
    ];

    const createCommands: Command[] = [
      {
        id: "create:new",
        label: "New document",
        hint: "Starts a blank local-first draft",
        keywords: "create add write draft",
        group: "Create",
        icon: Plus,
        run: onCreateDocument,
      },
    ];

    return [...docCommands, ...navCommands, ...createCommands];
  }, [documents, router, onCreateDocument]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands.slice(0, 40);
    return commands
      .filter((c) => c.keywords.toLowerCase().includes(q) || c.label.toLowerCase().includes(q))
      .slice(0, 40);
  }, [commands, query]);

  // Clamp during render rather than in an effect: when the query narrows the
  // result set, the highlight simply cannot point past the end.
  const safeIndex =
    results.length === 0 ? 0 : Math.min(activeIndex, results.length - 1);

  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const active = listRef.current?.querySelector<HTMLElement>(
      '[data-active="true"]',
    );
    active?.scrollIntoView({ block: "nearest" });
  }, [safeIndex, open]);

  const grouped = useMemo(() => {
    const map = new Map<Command["group"], Command[]>();
    for (const command of results) {
      const list = map.get(command.group) ?? [];
      list.push(command);
      map.set(command.group, list);
    }
    return [...map.entries()];
  }, [results]);

  let flatIndex = -1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="top-[14%] max-w-xl translate-y-0 gap-0 overflow-hidden p-0"
        aria-label="Command palette"
      >
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <DialogDescription className="sr-only">
          Search documents and run workspace commands. Use the arrow keys to move
          and Enter to run.
        </DialogDescription>

        <div className="flex items-center gap-2.5 border-b border-border px-4">
          <Search aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveIndex((i) => (i + 1) % Math.max(results.length, 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex(
                  (i) =>
                    (i - 1 + Math.max(results.length, 1)) %
                    Math.max(results.length, 1),
                );
              } else if (event.key === "Enter") {
                event.preventDefault();
                const target = results[safeIndex];
                if (target) {
                  close();
                  target.run();
                }
              }
            }}
            placeholder="Search documents or run a command…"
            aria-label="Search documents or run a command"
            aria-activedescendant={
              results[safeIndex] ? `cmd-${results[safeIndex]!.id}` : undefined
            }
            className="h-12 w-full min-w-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <Kbd>Esc</Kbd>
        </div>

        {results.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm font-medium text-foreground">No matches</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Nothing matched &ldquo;{query}&rdquo;. Try a document title, or create
              a new one.
            </p>
          </div>
        ) : (
          <ul
            ref={listRef}
            className="ds-scroll max-h-(--available-height) overflow-y-auto p-2"
          >
            {grouped.map(([group, items]) => (
              <li key={group}>
                <p className="px-2 pt-2 pb-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                  {group}
                </p>
                <ul>
                  {items.map((command) => {
                    flatIndex += 1;
                    const index = flatIndex;
                    const isActive = index === safeIndex;
                    const Icon = command.icon;
                    return (
                      <li key={command.id}>
                        <button
                          id={`cmd-${command.id}`}
                          type="button"
                          data-active={isActive}
                          onMouseMove={() => setActiveIndex(index)}
                          onClick={() => {
                            close();
                            command.run();
                          }}
                          className={cn(
                            "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors",
                            isActive
                              ? "bg-accent text-accent-foreground"
                              : "text-foreground hover:bg-muted/60",
                          )}
                        >
                          <Icon
                            className={cn(
                              "size-4 shrink-0",
                              isActive ? "text-primary" : "text-muted-foreground",
                            )}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">
                              {command.label}
                            </span>
                            {command.hint && (
                              <span className="block truncate text-[11px] text-muted-foreground">
                                {command.hint}
                              </span>
                            )}
                          </span>
                          {command.trailing}
                          {isActive && (
                            <CornerDownLeft
                              aria-hidden
                              className="size-3 shrink-0 text-muted-foreground"
                            />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center gap-3 border-t border-border bg-muted/40 px-4 py-2 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> navigate
          </span>
          <span className="inline-flex items-center gap-1">
            <Kbd>↵</Kbd> open
          </span>
          <span className="ml-auto">On {pathname === "/documents" ? "documents" : "workspace"}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
