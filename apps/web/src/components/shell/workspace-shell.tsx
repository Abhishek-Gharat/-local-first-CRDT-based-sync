"use client";

import { useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";
import { AppSidebar, type NavSection } from "@/components/shell/app-sidebar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface WorkspaceShellProps {
  nav: NavSection[];
  /** Rendered in the sidebar above the nav (brand) and below it (account). */
  brand: ReactNode;
  footer: ReactNode;
  children: ReactNode;
  /** Mobile top bar: the sidebar's trigger lives here. */
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

/**
 * Workspace application shell.
 *
 * ≥lg: a persistent, always-visible sidebar — this is the navigation model
 * for a workspace, not a page header with links.
 * <lg: the sidebar collapses into a slide-over drawer behind a top bar, so the
 * document list still gets the full viewport width on a phone instead of
 * being squeezed beside a 240px rail.
 */
export function WorkspaceShell({
  nav,
  brand,
  footer,
  children,
  title,
  subtitle,
  actions,
}: WorkspaceShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex min-h-dvh w-full">
      {/* Desktop rail */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex xl:w-64">
        <div className="flex h-14 shrink-0 items-center px-4">{brand}</div>
        <div className="ds-scroll flex-1 overflow-y-auto px-3 pb-4">
          <AppSidebar nav={nav} />
        </div>
        <div className="shrink-0 border-t border-sidebar-border p-3">{footer}</div>
      </aside>

      {/* Mobile top bar */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/90 px-3 backdrop-blur-md lg:hidden">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation"
            aria-expanded={drawerOpen}
            className="-ml-1"
          >
            <Menu aria-hidden className="size-4" />
          </Button>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-semibold tracking-tight">
              {title}
            </span>
            {subtitle && (
              <span className="truncate text-[11px] text-muted-foreground">
                {subtitle}
              </span>
            )}
          </div>
          {actions}
        </header>

        {children}
      </div>

      {/* Mobile drawer — reuses the exact same sidebar component as desktop */}
      <div
        className={cn(
          "fixed inset-0 z-50 lg:hidden",
          drawerOpen ? "" : "pointer-events-none",
        )}
        aria-hidden={!drawerOpen}
      >
        <button
          type="button"
          tabIndex={drawerOpen ? 0 : -1}
          aria-label="Close navigation"
          onClick={() => setDrawerOpen(false)}
          className={cn(
            "absolute inset-0 bg-foreground/30 backdrop-blur-[2px] transition-opacity duration-250",
            drawerOpen ? "opacity-100" : "opacity-0",
          )}
        />
        <div
          role="dialog"
          aria-modal={drawerOpen}
          aria-label="Navigation"
          className={cn(
            "absolute inset-y-0 left-0 flex w-64 flex-col border-r border-sidebar-border bg-sidebar shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
            drawerOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="flex h-14 shrink-0 items-center justify-between gap-2 px-4">
            {brand}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setDrawerOpen(false)}
              aria-label="Close navigation"
            >
              <X aria-hidden className="size-4" />
            </Button>
          </div>
          <div
            className="ds-scroll flex-1 overflow-y-auto px-3 pb-4"
            inert={!drawerOpen}
          >
            <AppSidebar nav={nav} onNavigate={() => setDrawerOpen(false)} />
          </div>
          <div className="shrink-0 border-t border-sidebar-border p-3">
            {footer}
          </div>
        </div>
      </div>
    </div>
  );
}
