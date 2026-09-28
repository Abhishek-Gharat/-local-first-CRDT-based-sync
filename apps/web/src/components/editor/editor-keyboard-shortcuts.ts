"use client";

import { Extension } from "@tiptap/core";
import {
  shortcutsForScope,
  type ShortcutDefinition,
} from "@/lib/keyboard/shortcuts";
import { requestLinkPopover } from "@/components/editor/link-popover-bridge";
import { requestFindReplace } from "@/components/editor/find-replace/find-replace-bridge";

/**
 * Translates a shortcut definition into the key string ProseMirror expects.
 *
 * `Mod` is ProseMirror's platform-aware primary modifier — ⌘ on macOS, Ctrl
 * everywhere else — which is exactly the `mod` token the dialog renders, so the
 * two can never disagree about which physical key is meant.
 */
function toProseMirrorKey(shortcut: ShortcutDefinition): string | null {
  if (!shortcut.keys) return null;
  return shortcut.keys
    .map((key) => {
      switch (key.toLowerCase()) {
        case "mod":
          return "Mod";
        case "shift":
          return "Shift";
        case "alt":
          return "Alt";
        case "ctrl":
          // On macOS the physical Control key is "Ctrl"; on other platforms
          // "Mod" already is Control, so this is only reachable if a shortcut
          // explicitly wants the other one.
          return "Ctrl";
        case "backspace":
          return "Backspace";
        default:
          return key;
      }
    })
    .join("-");
}

/** ProseMirror key string → the Tiptap command it runs. */
export const COMMANDS: Record<string, string> = {
  bold: "toggleBold",
  italic: "toggleItalic",
  underline: "toggleUnderline",
  strike: "toggleStrike",
  code: "toggleCode",
  clear: "unsetAllMarks",
  h1: "toggleHeading1",
  h2: "toggleHeading2",
  h3: "toggleHeading3",
  bulletList: "toggleBulletList",
  orderedList: "toggleOrderedList",
  blockquote: "toggleBlockquote",
  codeBlock: "toggleCodeBlock",
};

/**
 * Shortcuts that do not map to a Tiptap command.
 *
 * `link` opens the link popover, which is React state in the toolbar rather than
 * a ProseMirror command, so the keymap hands off to it through a bridge. Kept
 * as an explicit list (rather than a no-op binding) so that every key the
 * dialog advertises is still bound to something real.
 */
export const CUSTOM_COMMANDS: Record<string, () => boolean> = {
  link: () => {
    requestLinkPopover();
    return true;
  },
  find: () => {
    requestFindReplace();
    return true;
  },
};

/**
 * Installs the editor formatting shortcuts described in `SHORTCUTS`.
 *
 * The dialog and this keymap are generated from the same array, so a shortcut
 * cannot be advertised without being bound, nor bound without being listed.
 * Anything whose command is missing from `COMMANDS` and is not a custom command
 * is skipped rather than bound to a no-op, which would make the dialog
 * advertise a key that appears to do nothing.
 */
export const EditorKeyboardShortcuts = Extension.create({
  name: "editorKeyboardShortcuts",

  addKeyboardShortcuts() {
    const bindings: Record<string, () => boolean> = {};

    for (const shortcut of shortcutsForScope("editor")) {
      const key = toProseMirrorKey(shortcut);
      if (!key) continue;

      const commandName = COMMANDS[shortcut.id];
      if (commandName) {
        bindings[key] = () =>
          // `focus()` first so the command applies to the user's selection and
          // the caret is left where they were typing.
          this.editor.chain().focus()[commandName as "toggleBold"]().run();
        continue;
      }

      const custom = CUSTOM_COMMANDS[shortcut.id];
      if (custom) bindings[key] = custom;
    }

    return bindings;
  },
});
