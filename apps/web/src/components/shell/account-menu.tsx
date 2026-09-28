"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { ChevronsUpDown, LogOut, User as UserIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeControl } from "@/components/theme/theme-toggle";
import { getInitials } from "@/lib/collaboration/collaborator-colors";
import { getCollaboratorColor } from "@/lib/collaboration/collaborator-colors";

/**
 * Account control. Replaces the old header chip + separate sign-out button
 * with a single identity surface that also shows the workspace name — one
 * click to sign out instead of hunting for a second control.
 */
export function AccountMenu({
  name,
  email,
  workspaceLabel,
}: {
  name: string;
  email: string;
  workspaceLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const initials = getInitials(name);
  const color = getCollaboratorColor(email || name);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        className="flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left transition-colors hover:bg-sidebar-accent focus-visible:ring-3 focus-visible:ring-sidebar-ring/50 focus-visible:outline-none aria-expanded:bg-sidebar-accent"
      >
        <span
          aria-hidden
          className="flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white ring-2 ring-sidebar"
          style={{ backgroundColor: color }}
        >
          {initials}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-xs font-medium text-foreground">
            {name}
          </span>
          <span className="truncate text-[11px] text-muted-foreground">
            {workspaceLabel}
          </span>
        </span>
        <ChevronsUpDown
          aria-hidden
          className="size-3.5 shrink-0 text-muted-foreground"
        />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" side="top" className="w-60">
        {/* Base UI requires a GroupLabel to live inside a Group. */}
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center gap-2.5 px-2 py-2 normal-case">
            <span
              aria-hidden
              className="flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
              style={{ backgroundColor: color }}
            >
              {initials}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-xs font-semibold text-foreground">
                {name}
              </span>
              <span className="block truncate text-[11px] font-normal text-muted-foreground">
                {email}
              </span>
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <ThemeControl className="px-1.5 py-1" />
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            setOpen(false);
            void signOut({ callbackUrl: "/login" });
          }}
        >
          <LogOut aria-hidden className="size-3.5" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AccountMenuFallback({ name }: { name: string }) {
  return (
    <span className="flex h-8 items-center gap-2 px-1.5 text-xs text-muted-foreground">
      <UserIcon aria-hidden className="size-3.5" />
      <span className="truncate">{name}</span>
    </span>
  );
}
