import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { WorkspaceShell } from "@/components/shell/workspace-shell";
import { AccountMenu } from "@/components/shell/account-menu";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Wordmark } from "@/components/shell/wordmark";
import type { NavSection } from "@/components/shell/app-sidebar";
import { countDocumentStats } from "@/lib/workspace/document-stats";

/**
 * Workspace shell for the signed-in product. Unlike the marketing shell this
 * is a real application frame: persistent rail on desktop, drawer on mobile,
 * and an account surface in the sidebar footer.
 */
export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) redirect("/login");

  const stats = await countDocumentStats(user.id);
  const name = user.name || user.email || "Account";

  const nav: NavSection[] = [
    {
      title: "Workspace",
      items: [
        {
          label: "All documents",
          href: "/documents",
          icon: "file-text",
          count: stats.total,
          exact: true,
        },
        {
          label: "Owned by me",
          href: "/documents?view=owned",
          icon: "folder-open",
          count: stats.owned,
        },
        {
          label: "Shared with me",
          href: "/documents?view=shared",
          icon: "users",
          count: stats.shared,
        },
      ],
    },
    {
      title: "Capabilities",
      items: [
        {
          label: "Version history",
          href: "/documents?view=history",
          icon: "history",
          count: stats.versions,
        },
        {
          label: "AI summaries",
          href: "/documents?view=ai",
          icon: "sparkles",
        },
      ],
    },
  ];

  return (
    <WorkspaceShell
      nav={nav}
      title="Documents"
      subtitle={`${stats.total} document${stats.total === 1 ? "" : "s"}`}
      brand={
        <Link
          href="/documents"
          className="flex items-center gap-2.5 rounded-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <Wordmark className="size-6.5" />
          <span className="text-sm font-semibold tracking-tight">docsync</span>
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            Workspace
          </span>
        </Link>
      }
      footer={
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2 px-1.5">
            <span className="text-[11px] font-medium text-muted-foreground">
              Appearance
            </span>
            <ThemeToggle />
          </div>
          <AccountMenu
            name={name}
            email={user.email ?? ""}
            workspaceLabel={user.email ?? "Personal workspace"}
          />
        </div>
      }
    >
      {children}
    </WorkspaceShell>
  );
}
