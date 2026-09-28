"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileText,
  FolderOpen,
  History,
  Users,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICON_MAP: Record<string, LucideIcon> = {
  "file-text": FileText,
  "folder-open": FolderOpen,
  "users": Users,
  "history": History,
  "sparkles": Sparkles,
};

export interface NavItem {
  label: string;
  href: string;
  icon: string | LucideIcon;
  /** Rendered as a count chip to the right of the label. */
  count?: number;
  /** Match the path exactly rather than by prefix. */
  exact?: boolean;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

/**
 * Sidebar navigation. One component drives both the desktop rail and the
 * mobile drawer, so the two can never drift.
 */
export function AppSidebar({
  nav,
  onNavigate,
}: {
  nav: NavSection[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav aria-label="Workspace" className="flex flex-col gap-6 py-4">
      {nav.map((section) => (
        <div key={section.title} className="flex flex-col gap-0.5">
          <p className="px-3 pb-1.5 text-xs font-semibold tracking-wider text-muted-foreground/90 uppercase">
            {section.title}
          </p>
          {section.items.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = typeof item.icon === "string" ? ICON_MAP[item.icon] ?? FileText : item.icon;
            return (
              <Link
                key={item.href + item.label}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative flex h-9 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                  "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                {/* Active rail marker — a shape cue, so the current section is
                    identifiable without relying on the tint alone. */}
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-1/2 -left-3 h-4 w-0.5 -translate-y-1/2 rounded-r-full bg-primary transition-opacity",
                    active ? "opacity-100" : "opacity-0",
                  )}
                />
                <Icon
                  aria-hidden
                  className={cn(
                    "size-4.5 shrink-0 transition-colors",
                    active
                      ? "text-primary"
                      : "text-muted-foreground/80 group-hover:text-foreground",
                  )}
                />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.count !== undefined && item.count > 0 && (
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
                      active
                        ? "bg-primary/12 text-primary"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {item.count}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
