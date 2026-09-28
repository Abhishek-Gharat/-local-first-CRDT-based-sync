"use client";

import { useEffect } from "react";
import { Command } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import {
  SHORTCUT_GROUPS,
  detectMac,
  formatShortcut,
  isTypingTarget,
  matchesBareQuestionMark,
  matchesShortcut,
  shortcutsForScope,
  type ShortcutGroupId,
  type ShortcutScope,
} from "@/lib/keyboard/shortcuts";
import { useIsMac } from "@/lib/keyboard/use-is-mac";
import { cn } from "@/lib/utils";

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Which set of shortcuts to show. The editor has formatting keys the
   * workspace has no canvas for, so listing them there would be a lie.
   */
  scope: ShortcutScope;
}

/**
 * Keyboard shortcut reference.
 *
 * Rendered straight from `SHORTCUTS`, which is also what installs the editor
 * keymap — so every row here is a shortcut that genuinely fires. Actions that
 * only exist in a menu are listed with the menu that holds them rather than an
 * invented key combination.
 */
export function KeyboardShortcutsDialog({
  open,
  onOpenChange,
  scope,
}: KeyboardShortcutsDialogProps) {
  const isMac = useIsMac();
  const items = shortcutsForScope(scope);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <span
            aria-hidden
            className="mb-1 flex size-9 w-fit items-center justify-center rounded-lg bg-primary/10 text-primary"
          >
            <Command aria-hidden className="size-4" />
          </span>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            {isMac
              ? "Press ⌘ to combine with a key. Escape closes this dialog."
              : "Press Ctrl to combine with a key. Escape closes this dialog."}
          </DialogDescription>
        </DialogHeader>

        <div className="ds-scroll -mx-1 flex max-h-[min(26rem,60dvh)] flex-col gap-5 overflow-y-auto px-1">
          {SHORTCUT_GROUPS.map((group) => {
            const groupItems = items.filter(
              (shortcut) => shortcut.group === group.id,
            );
            if (groupItems.length === 0) return null;

            return (
              <section key={group.id} aria-labelledby={`shortcuts-${group.id}`}>
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <h3
                    id={`shortcuts-${group.id}`}
                    className="text-[11px] font-semibold tracking-wide text-foreground uppercase"
                  >
                    {group.title}
                  </h3>
                  <p className="text-[10px] text-muted-foreground">
                    {group.description}
                  </p>
                </div>

                <ul className="flex flex-col gap-0.5">
                  {groupItems.map((shortcut) => {
                    const keys = formatShortcut(shortcut.keys, isMac);
                    return (
                      <li
                        key={shortcut.id}
                        className="flex items-center justify-between gap-4 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/50"
                      >
                        <span className="min-w-0">
                          <span className="block text-xs text-foreground">
                            {shortcut.label}
                          </span>
                          {shortcut.hint && (
                            <span className="block text-[10px] text-muted-foreground">
                              {shortcut.hint}
                            </span>
                          )}
                        </span>

                        {keys.length > 0 ? (
                          <span className="flex shrink-0 items-center gap-1">
                            {keys.map((key, index) => (
                              <Kbd
                                key={`${shortcut.id}-${key}-${index}`}
                                className={cn(
                                  // The separator only reads well on
                                  // platforms that spell modifiers out.
                                  !isMac &&
                                    index > 0 &&
                                    "ml-1.5 before:content-['+'] before:text-muted-foreground/60",
                                )}
                              >
                                {key}
                              </Kbd>
                            ))}
                          </span>
                        ) : (
                          <span className="shrink-0 text-[10px] text-muted-foreground/70">
                            no shortcut
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export interface ShortcutsDialogController {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

/**
 * Installs the two global triggers for the dialog:
 *
 *   `?`     — but only when the user is not typing. Inside the editor canvas
 *             `?` is a literal character, and hijacking it would corrupt the
 *             document; the app-bar button covers that case.
 *   `⌘/`    — always available, because a modifier is required and so it
 *             cannot collide with ordinary typing.
 */
export function useShortcutsDialogTriggers(
  onToggle: () => void,
  enabled = true,
): void {
  useEffect(() => {
    if (!enabled) return;

    function onKeyDown(event: KeyboardEvent) {
      const isMac = detectMac();

      if (
        matchesShortcut(
          {
            key: event.key,
            metaKey: event.metaKey,
            ctrlKey: event.ctrlKey,
            shiftKey: event.shiftKey,
            altKey: event.altKey,
          },
          ["mod", "slash"],
          isMac,
        )
      ) {
        event.preventDefault();
        onToggle();
        return;
      }

      // A bare "?" — no modifiers that would make it a different gesture, and
      // not while typing.
      if (
        matchesBareQuestionMark(event) &&
        !isTypingTarget(event.target)
      ) {
        event.preventDefault();
        onToggle();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onToggle, enabled]);
}

export type { ShortcutGroupId };
