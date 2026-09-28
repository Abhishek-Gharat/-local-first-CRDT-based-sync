"use client";

import { useMemo } from "react";
import type { ActiveCollaborator } from "@/lib/collaboration/collaborator-colors";
import { getInitials } from "@/lib/collaboration/collaborator-colors";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface PresenceAvatarsProps {
  collaborators: ActiveCollaborator[];
  maxVisible?: number;
}

/**
 * Who is in this document right now.
 *
 * Rendered as a list so the count is exposed to assistive tech, with a live
 * "N people editing" summary. Avatars use the same design-system tooltip as
 * every other hover affordance, and the current user is always pinned first
 * and badged, so "am I in the list?" is never ambiguous.
 */
export function PresenceAvatars({
  collaborators,
  maxVisible = 4,
}: PresenceAvatarsProps) {
  const sorted = useMemo(() => {
    return [...collaborators].sort((a, b) => {
      if (a.isSelf && !b.isSelf) return -1;
      if (!a.isSelf && b.isSelf) return 1;
      return a.user.name.localeCompare(b.user.name);
    });
  }, [collaborators]);

  if (sorted.length === 0) return null;

  const visible = sorted.slice(0, maxVisible);
  const overflowCount = sorted.length - visible.length;
  const others = sorted.filter((c) => !c.isSelf).length;

  return (
    <div className="flex items-center gap-2">
      <div role="list" aria-label="Active collaborators" className="flex items-center -space-x-1.5">
        {visible.map((c) => {
          const title = c.isSelf ? `${c.user.name} (You)` : c.user.name;
          const initials = getInitials(c.user.name);
          return (
            <Tooltip key={c.clientId}>
              <TooltipTrigger
                render={
                  <span
                    role="listitem"
                    aria-label={title}
                    className={cn(
                      "relative flex size-7 shrink-0 cursor-default items-center justify-center rounded-full text-[10px] font-semibold text-white shadow-xs ring-2 ring-background transition-transform duration-150 hover:z-10 hover:scale-110 select-none",
                      // Your own avatar also gets a ring in your cursor colour,
                      // matching the caret you see in the document.
                      c.isSelf && "ring-offset-1",
                    )}
                    style={{
                      backgroundColor: c.user.color,
                      ...(c.isSelf
                        ? { boxShadow: `0 0 0 1px ${c.user.color}` }
                        : {}),
                    }}
                  />
                }
              >
                {initials}
              </TooltipTrigger>
              <TooltipContent>
                <span
                  aria-hidden
                  className="size-1.5 rounded-full"
                  style={{ backgroundColor: c.user.color }}
                />
                {title}
              </TooltipContent>
            </Tooltip>
          );
        })}

        {overflowCount > 0 && (
          <span
            role="listitem"
            aria-label={`${overflowCount} more collaborator${overflowCount > 1 ? "s" : ""}`}
            className="flex size-7 shrink-0 cursor-default items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground ring-2 ring-background select-none tabular-nums"
          >
            +{overflowCount}
          </span>
        )}
      </div>

      {others > 0 && (
        <span className="hidden text-[11px] text-muted-foreground lg:inline">
          {others === 1 ? "1 other editing" : `${others} others editing`}
        </span>
      )}
    </div>
  );
}
