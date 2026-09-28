"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { Menu, X, ArrowRight, LayoutDashboard, LogOut } from "lucide-react";
import { Wordmark } from "@/components/shell/wordmark";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LINKS = [
  { label: "Collaboration", href: "#collaboration" },
  { label: "Offline", href: "#offline" },
  { label: "History", href: "#history" },
  { label: "Security", href: "#security" },
];

interface MarketingNavProps {
  user: { name: string; email: string } | null;
}

/**
 * Marketing navigation. Becomes elevated (solid + shadow) once the page is
 * scrolled so the hero's decorative background never fights the links, and
 * collapses to a disclosure panel below `md` instead of overflowing.
 */
export function MarketingNav({ user }: MarketingNavProps) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      data-scrolled={scrolled}
      className={cn(
        "sticky top-0 z-50 w-full transition-all duration-300",
        scrolled
          ? "border-b border-border bg-background/85 backdrop-blur-md"
          : "border-b border-transparent bg-transparent",
      )}
    >
      <div className="mx-auto flex h-15 w-full max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link
          href={user ? "/documents" : "/"}
          onClick={close}
          className="group flex shrink-0 items-center gap-2.5 rounded-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <Wordmark className="size-7 transition-transform duration-300 group-hover:rotate-[-8deg]" />
          <span className="text-[15px] font-semibold tracking-tight">
            docsync
          </span>
        </Link>

        <nav
          aria-label="Product"
          className="ml-4 hidden items-center gap-1 md:flex"
        >
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-md px-2.5 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                nativeButton={false}
                render={
                  <Link href="/documents" className="hidden font-medium sm:inline-flex">
                    <LayoutDashboard aria-hidden className="size-3.5" />
                    Workspace
                  </Link>
                }
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="hidden font-medium sm:inline-flex"
              >
                Sign out
              </Button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground sm:inline-flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Sign in
              </Link>
              <Button
                size="sm"
                nativeButton={false}
                render={
                  <Link href="/register" className="gap-1.5 font-medium">
                    Get started
                    <ArrowRight aria-hidden className="size-3.5" />
                  </Link>
                }
              />
            </>
          )}

          <Button
            variant="ghost"
            size="icon-sm"
            className="md:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? (
              <X aria-hidden className="size-4" />
            ) : (
              <Menu aria-hidden className="size-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Mobile disclosure panel */}
      <div
        className={cn(
          "grid overflow-hidden border-border bg-background/95 backdrop-blur-md transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] md:hidden",
          open
            ? "grid-rows-[1fr] border-b opacity-100"
            : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="min-h-0">
          <nav
            aria-label="Product"
            className="mx-auto flex w-full max-w-6xl flex-col gap-0.5 px-4 py-3"
          >
            {LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
            <div className="mt-2 flex flex-col gap-2 border-t border-border pt-3">
              {user ? (
                <>
                  <Button
                    nativeButton={false}
                    onClick={close}
                    render={
                      <Link href="/documents" className="w-full font-medium">
                        <LayoutDashboard aria-hidden className="size-3.5" />
                        Open workspace
                      </Link>
                    }
                  />
                  <Button
                    variant="outline"
                    className="w-full font-medium"
                    onClick={() => signOut({ callbackUrl: "/login" })}
                  >
                    <LogOut aria-hidden className="size-3.5" />
                    Sign out
                  </Button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    onClick={close}
                    className="flex h-9 w-full items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted/60"
                  >
                    Sign in
                  </Link>
                  <Button
                    nativeButton={false}
                    onClick={close}
                    render={
                      <Link href="/register" className="w-full font-medium">
                        Create free account
                        <ArrowRight aria-hidden className="size-3.5" />
                      </Link>
                    }
                  />
                </>
              )}
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}
