/**
 * Single source of truth for the editor's and workspace's keyboard shortcuts.
 *
 * The shortcut dialog, the Tiptap keymap and the unit tests all read from this
 * module, which is the only way to guarantee the dialog cannot advertise a
 * shortcut that nothing handles. An earlier version of this feature listed a
 * dozen combinations (`⌘B`, `⌘⌥1`, …) that the editor had no keymap for at
 * all — a discoverability dialog full of dead keys is worse than none, so the
 * bindings are defined here and installed from here.
 *
 * Anything not listed here is not bound. Note that `mod+k` is deliberately
 * listed twice, once per surface: it is the link popover in the editor and the
 * command palette in the workspace. The scopes keep them apart, so each screen
 * advertises only the key it actually handles there.
 */

export type ShortcutGroupId = "formatting" | "blocks" | "document";

export interface ShortcutGroup {
  id: ShortcutGroupId;
  title: string;
  description: string;
}

export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    id: "formatting",
    title: "Text formatting",
    description: "Applies to the selected text.",
  },
  {
    id: "blocks",
    title: "Blocks & structure",
    description: "Changes the block the cursor sits in.",
  },
  {
    id: "document",
    title: "Document & actions",
    description: "Applies to the whole document.",
  },
];

/** `"mod"` is ⌘ on macOS and Ctrl everywhere else. */
export type ShortcutKey = "mod" | "shift" | "alt" | "ctrl" | string;

/** The two surfaces a shortcut can belong to. */
export type ShortcutScope = "editor" | "workspace";

export interface ShortcutDefinition {
  id: string;
  label: string;
  group: ShortcutGroupId;
  /**
   * `null` for actions that exist in a menu but have no key combination —
   * rendered without a key hint rather than with an invented one.
   */
  keys: ShortcutKey[] | null;
  /**
   * Where the shortcut is actually bound. The editor and the workspace show
   * different lists, because a document canvas does not exist in the
   * workspace and the editor has no document list.
   */
  scope: readonly ShortcutScope[];
  /** Extra note shown under the label, e.g. that it is a typing rule. */
  hint?: string;
}

const EDITOR: readonly ShortcutScope[] = ["editor"];
const BOTH: readonly ShortcutScope[] = ["editor", "workspace"];

export const SHORTCUTS: ShortcutDefinition[] = [
  // ── Text formatting ────────────────────────────────────────────────
  { id: "bold", label: "Bold", group: "formatting", keys: ["mod", "b"], scope: EDITOR },
  { id: "italic", label: "Italic", group: "formatting", keys: ["mod", "i"], scope: EDITOR },
  { id: "underline", label: "Underline", group: "formatting", keys: ["mod", "u"], scope: EDITOR },
  { id: "strike", label: "Strikethrough", group: "formatting", keys: ["mod", "shift", "x"], scope: EDITOR },
  { id: "code", label: "Inline code", group: "formatting", keys: ["mod", "e"], scope: EDITOR },
  {
    id: "link",
    label: "Add or edit link",
    group: "formatting",
    keys: ["mod", "k"],
    scope: EDITOR,
  },
  {
    id: "find",
    label: "Find and replace",
    group: "document",
    keys: ["mod", "f"],
    scope: EDITOR,
  },
  { id: "clear", label: "Clear formatting", group: "formatting", keys: ["mod", "shift", "backspace"], scope: EDITOR },

  // ── Blocks & structure ─────────────────────────────────────────────
  { id: "h1", label: "Heading 1", group: "blocks", keys: ["mod", "alt", "1"], scope: EDITOR },
  { id: "h2", label: "Heading 2", group: "blocks", keys: ["mod", "alt", "2"], scope: EDITOR },
  { id: "h3", label: "Heading 3", group: "blocks", keys: ["mod", "alt", "3"], scope: EDITOR },
  { id: "bulletList", label: "Bullet list", group: "blocks", keys: ["mod", "shift", "8"], scope: EDITOR },
  { id: "orderedList", label: "Numbered list", group: "blocks", keys: ["mod", "shift", "7"], scope: EDITOR },
  { id: "blockquote", label: "Quote", group: "blocks", keys: ["mod", "shift", "9"], scope: EDITOR },
  { id: "codeBlock", label: "Code block", group: "blocks", keys: ["mod", "alt", "c"], scope: EDITOR },
  {
    id: "divider",
    label: "Divider",
    group: "blocks",
    keys: null,
    scope: EDITOR,
    hint: "Type --- then a space",
  },

  // ── Document & actions ─────────────────────────────────────────────
  {
    id: "palette",
    label: "Search & command palette",
    group: "document",
    keys: ["mod", "k"],
    scope: ["workspace"],
  },
  {
    id: "newDocument",
    label: "New document",
    group: "document",
    keys: null,
    scope: ["workspace"],
    hint: "New document button",
  },
  {
    id: "switchView",
    label: "Switch between list and grid",
    group: "document",
    keys: null,
    scope: ["workspace"],
    hint: "Layout toggle in the control bar",
  },
  {
    id: "saveVersion",
    label: "Save a version",
    group: "document",
    keys: ["mod", "s"],
    scope: EDITOR,
  },
  {
    id: "taskList",
    label: "Task list",
    group: "blocks",
    keys: null,
    scope: EDITOR,
    // The dash-less form is the one that works: `- [ ] ` is claimed by the
    // bullet list shorthand the moment the space after the dash is typed, so
    // the task list rule never sees it. `[ ] ` is the built-in Tiptap
    // shorthand and is what the editor actually responds to.
    hint: "Type [ ] then a space",
  },
  {
    id: "shortcuts",
    label: "Show keyboard shortcuts",
    group: "document",
    keys: ["mod", "slash"],
    scope: BOTH,
  },
  {
    id: "export",
    label: "Export as Markdown or HTML",
    group: "document",
    keys: null,
    scope: EDITOR,
    hint: "More actions menu",
  },
  {
    id: "duplicate",
    label: "Make a copy",
    group: "document",
    keys: null,
    scope: EDITOR,
    hint: "More actions menu",
  },
];

export function shortcutsForGroup(
  group: ShortcutGroupId,
  scope?: ShortcutScope,
): ShortcutDefinition[] {
  return SHORTCUTS.filter(
    (shortcut) =>
      shortcut.group === group && (scope ? shortcut.scope.includes(scope) : true),
  );
}

/** The definitions a given surface should advertise. */
export function shortcutsForScope(scope: ShortcutScope): ShortcutDefinition[] {
  return SHORTCUTS.filter((shortcut) => shortcut.scope.includes(scope));
}

/** Looks up a definition by id, for consumers that need to describe one. */
export function findShortcut(id: string): ShortcutDefinition | undefined {
  return SHORTCUTS.find((shortcut) => shortcut.id === id);
}

function isMacPlatform(platform: string): boolean {
  return /mac|iphone|ipad|ipod/i.test(platform);
}

/** Detects Apple platforms, where the primary modifier is ⌘ rather than Ctrl. */
export function detectMac(
  platform: string = typeof navigator === "undefined" ? "" : navigator.platform,
): boolean {
  return isMacPlatform(platform);
}

const MAC_GLYPHS: Record<string, string> = {
  mod: "⌘",
  shift: "⇧",
  alt: "⌥",
  ctrl: "⌃",
};

const OTHER_LABELS: Record<string, string> = {
  mod: "Ctrl",
  shift: "Shift",
  alt: "Alt",
  ctrl: "Ctrl",
};

const NAMED_KEYS: Record<string, string> = {
  slash: "/",
  backspace: "Backspace",
  delete: "Backspace",
  enter: "Enter",
  escape: "Esc",
};

const MAC_NAMED_GLYPHS: Record<string, string> = {
  backspace: "⌫",
  delete: "⌦",
  enter: "↩",
  escape: "⎋",
};

/**
 * Renders a shortcut for display: `⌘ ⇧ X` on macOS, `Ctrl + Shift + X`
 * elsewhere, using the platform's own conventions rather than a single
 * one-size-fits-all string.
 */
export function formatShortcut(
  keys: ShortcutKey[] | null,
  isMac: boolean,
): string[] {
  if (!keys) return [];
  return keys.map((key) => {
    const lower = key.toLowerCase();
    if (lower in MAC_GLYPHS) {
      return isMac ? MAC_GLYPHS[lower]! : OTHER_LABELS[lower]!;
    }
    // Named keys are printed the way the platform prints them — never as the
    // internal name, which would put the word "slash" in a tooltip.
    if (lower in NAMED_KEYS) {
      return isMac ? MAC_NAMED_GLYPHS[lower] ?? NAMED_KEYS[lower]! : NAMED_KEYS[lower]!;
    }
    // A literal character, printed the way the platform prints it.
    return key.length === 1 ? key.toUpperCase() : key;
  });
}

const MODIFIERS = new Set(["mod", "ctrl", "shift", "alt"]);

/** Keys whose reported `event.key` differs from the logical name we use. */
const CHAR_ALIASES: Record<string, string> = {
  "/": "slash",
  // Shift+/ is reported as "?" on most layouts.
  "?": "slash",
  backspace: "backspace",
  // The "delete" key on macOS laptops.
  delete: "backspace",
};

/**
 * Whether a keyboard event matches a shortcut definition.
 *
 * Matching is strict: the set of held modifiers must match the declared
 * modifiers exactly, and the character must match exactly. That is what stops
 * `⌘B` from firing while the user is reaching for `⌘⇧B`.
 *
 * Shared by the window-level handlers and the tests, so "what the dialog
 * advertises" and "what the app handles" are verified by the same code.
 */
export function matchesShortcut(
  event: {
    key: string;
    metaKey: boolean;
    ctrlKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
  },
  keys: ShortcutKey[] | null,
  isMac: boolean,
): boolean {
  if (!keys || keys.length === 0) return false;

  const held = new Set<string>();
  if (isMac ? event.metaKey : event.ctrlKey) held.add("mod");
  if (isMac ? event.ctrlKey : event.metaKey) held.add("ctrl");
  if (event.shiftKey) held.add("shift");
  if (event.altKey) held.add("alt");

  const raw = event.key.toLowerCase();
  const char = CHAR_ALIASES[raw] ?? raw;

  const required = keys.map((key) => key.toLowerCase());
  const requiredMods = required.filter((key) => MODIFIERS.has(key));
  const requiredChars = required.filter((key) => !MODIFIERS.has(key));

  // Modifiers must match exactly — no extras, none missing.
  if (requiredMods.length !== held.size) return false;
  for (const modifier of requiredMods) {
    if (!held.has(modifier)) return false;
  }

  // Exactly one non-modifier key, and it must be the one pressed.
  if (requiredChars.length !== 1) return false;
  return requiredChars[0] === char;
}

/**
 * True for a bare, unmodified `?` — the "press ? for shortcuts" gesture.
 *
 * Note that `shiftKey` is deliberately *not* required to be false: on a
 * standard layout `?` is typed with Shift held, so rejecting Shift would make
 * this trigger unreachable on exactly the keyboards it is meant for. Shift
 * cannot be excluded here because it is what produces the character, so the
 * check is that no *other* modifier is held and the character is literally `?`
 * (a `⌘?` or `Ctrl+?` is a different gesture and falls through).
 */
export function matchesBareQuestionMark(event: {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
}): boolean {
  return event.key === "?" && !event.metaKey && !event.ctrlKey && !event.altKey;
}

/**
 * True when the event target is somewhere the user is typing, where a bare
 * `?` must be a literal question mark rather than a command.
 *
 * The editable check walks up from the target rather than reading
 * `isContentEditable` on it: a keydown inside the ProseMirror canvas targets a
 * `<p>` or a text node's parent, which does not itself carry the
 * `contenteditable` attribute. The walk stops at the *first* ancestor that
 * declares the attribute, so a `contenteditable="false"` island nested inside
 * an editable region is correctly reported as not-typing. `isContentEditable`
 * is kept as the fast path, which real browsers answer authoritatively.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;

  let node: HTMLElement | null = target;
  while (node) {
    const declared = node.getAttribute("contenteditable");
    if (declared !== null) {
      return declared.toLowerCase() !== "false";
    }
    node = node.parentElement;
  }

  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}
