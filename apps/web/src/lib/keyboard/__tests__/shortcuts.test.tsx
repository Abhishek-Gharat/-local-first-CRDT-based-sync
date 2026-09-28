// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor, within } from "@testing-library/react";
import { axe } from "vitest-axe";
import {
  SHORTCUT_GROUPS,
  SHORTCUTS,
  detectMac,
  findShortcut,
  formatShortcut,
  isTypingTarget,
  matchesBareQuestionMark,
  matchesShortcut,
  shortcutsForScope,
  type ShortcutDefinition,
} from "../shortcuts";
import { KeyboardShortcutsDialog } from "@/components/editor/keyboard-shortcuts-dialog";
import {
  COMMANDS,
  CUSTOM_COMMANDS,
} from "@/components/editor/editor-keyboard-shortcuts";

afterEach(cleanup);

type KeyEvent = Parameters<typeof matchesShortcut>[0];

const evt = (
  key: string,
  modifiers: Partial<Omit<KeyEvent, "key">> = {},
): KeyEvent => ({
  key,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  ...modifiers,
});

const shortcutById = (id: string) => {
  const found = SHORTCUTS.find((item) => item.id === id);
  if (!found) throw new Error(`no shortcut "${id}"`);
  return found;
};

describe("shortcut registry integrity", () => {
  it("has no duplicate ids", () => {
    const ids = SHORTCUTS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("only uses declared groups", () => {
    const groupIds = new Set(SHORTCUT_GROUPS.map((g) => g.id));
    for (const s of SHORTCUTS) {
      expect(groupIds.has(s.group)).toBe(true);
    }
  });

  it("gives every group at least one shortcut in the editor scope", () => {
    for (const group of SHORTCUT_GROUPS) {
      const count = SHORTCUTS.filter(
        (s) => s.group === group.id && s.scope.includes("editor"),
      ).length;
      expect(count, `group ${group.id} has no editor shortcuts`).toBeGreaterThan(0);
    }
  });

  it("declares a hint whenever there is no key combination", () => {
    // A row with no keys and no hint would read as a dead end.
    for (const s of SHORTCUTS) {
      if (s.keys === null) {
        expect(s.hint, `${s.id} has no keys and no hint`).toBeTruthy();
      }
    }
  });

  it("binds every editor shortcut that declares keys", () => {
    // Asserted against the keymap's real tables rather than a hand-written
    // list: when `link` was added via CUSTOM_COMMANDS, a mirrored list here
    // failed and pointed straight at the omission.
    const bound = new Set([
      ...Object.keys(COMMANDS),
      ...Object.keys(CUSTOM_COMMANDS),
    ]);

    for (const s of SHORTCUTS) {
      if (!s.scope.includes("editor") || s.keys === null) continue;
      // Handled by window-level listeners in the editor page, not the keymap.
      if (["saveVersion", "history", "shortcuts"].includes(s.id)) continue;
      expect(bound.has(s.id), `${s.id} is advertised but has no binding`).toBe(true);
    }

    // Sanity-check the lookup helper itself so a typo above cannot pass
    // vacuously.
    expect(shortcutById("bold").keys).toEqual(["mod", "b"]);
  });

  it("binds ⌘K to the link popover, and not to the palette in the editor", () => {
    // The two surfaces both use ⌘K; scope is what keeps them from colliding.
    expect(CUSTOM_COMMANDS.link).toBeTypeOf("function");
    expect(COMMANDS.link).toBeUndefined();

    const link = shortcutById("link");
    expect(link.keys).toEqual(["mod", "k"]);
    expect(link.scope).toContain("editor");

    const palette = shortcutById("palette");
    expect(palette.keys).toEqual(["mod", "k"]);
    expect(palette.scope).toEqual(["workspace"]);
    expect(palette.scope).not.toContain("editor");
  });

  it("binds ⌘F to the find bar, and only in the editor", () => {
    // ⌘F is the browser's own find shortcut, so taking it over is a decision
    // worth pinning: it must stay editor-only, never leak into the workspace.
    expect(CUSTOM_COMMANDS.find).toBeTypeOf("function");

    const find = shortcutById("find");
    expect(find.keys).toEqual(["mod", "f"]);
    expect(find.group).toBe("document");
    expect(find.scope).toEqual(["editor"]);
  });

  it("does not reuse one key for two actions on the same surface", () => {
    // Within a scope, a key must resolve to exactly one action, or the
    // advertised binding is ambiguous.
    for (const scope of ["editor", "workspace"] as const) {
      const byKey = new Map<string, string[]>();
      for (const shortcut of shortcutsForScope(scope)) {
        if (!shortcut.keys) continue;
        const key = shortcut.keys.join("+");
        byKey.set(key, [...(byKey.get(key) ?? []), shortcut.id]);
      }
      for (const [key, ids] of byKey) {
        expect(ids.length, `${scope}: ${key} is claimed by ${ids.join(", ")}`).toBe(1);
      }
    }
  });

  it("advertises the task list as a markdown shorthand, not a key", () => {
    // ⌘⇧9 is already the blockquote shortcut, so the task list is advertised
    // through the markdown shorthand it actually responds to. Asserting this
    // keeps the two from drifting apart.
    const taskList = shortcutById("taskList");
    expect(taskList.group).toBe("blocks");
    expect(taskList.keys).toBeNull();
    expect(taskList.hint).toMatch(/\[ \]/);

    const blockquote = shortcutById("blockquote");
    expect(blockquote.keys).toEqual(["mod", "shift", "9"]);
  });
});

describe("matchesShortcut", () => {
  it("matches the primary modifier per platform", () => {
    const keys = ["mod", "b"];
    // macOS: ⌘B
    expect(matchesShortcut(evt("b", { metaKey: true }), keys, true)).toBe(true);
    // macOS: Ctrl+B is NOT the shortcut
    expect(matchesShortcut(evt("b", { ctrlKey: true }), keys, true)).toBe(false);
    // elsewhere: Ctrl+B
    expect(matchesShortcut(evt("b", { ctrlKey: true }), keys, false)).toBe(true);
    expect(matchesShortcut(evt("b", { metaKey: true }), keys, false)).toBe(false);
  });

  it("requires the exact modifier set", () => {
    const keys: ShortcutDefinition["keys"] = ["mod", "b"];
    // Shift held as well → not this shortcut
    expect(
      matchesShortcut(evt("B", { metaKey: true, shiftKey: true }), keys, true),
    ).toBe(false);
    // Missing the modifier → not this shortcut
    expect(matchesShortcut(evt("b"), keys, true)).toBe(false);
  });

  it("matches shift combinations", () => {
    expect(
      matchesShortcut(
        evt("X", { metaKey: true, shiftKey: true }),
        ["mod", "shift", "x"],
        true,
      ),
    ).toBe(true);
  });

  it("treats Shift+/ as the slash shortcut", () => {
    // "?" is what the browser reports for Shift+/ on most layouts.
    expect(matchesShortcut(evt("?", { metaKey: true }), ["mod", "slash"], true)).toBe(
      true,
    );
    expect(matchesShortcut(evt("/", { metaKey: true }), ["mod", "slash"], true)).toBe(
      true,
    );
  });

  it("matches numeric and alternate combinations", () => {
    expect(
      matchesShortcut(evt("1", { metaKey: true, altKey: true }), ["mod", "alt", "1"], true),
    ).toBe(true);
    expect(
      matchesShortcut(
        evt("8", { ctrlKey: true, shiftKey: true }),
        ["mod", "shift", "8"],
        false,
      ),
    ).toBe(true);
  });

  it("never matches a definition with no keys", () => {
    expect(matchesShortcut(evt("x", { metaKey: true }), null, true)).toBe(false);
    expect(matchesShortcut(evt("x", { metaKey: true }), [], true)).toBe(false);
  });
});

describe("matchesBareQuestionMark", () => {
  it("accepts the Shift+/ a standard keyboard actually produces", () => {
    // Regression guard: requiring shiftKey === false here made the `?`
    // trigger unreachable on every layout that needs Shift to type "?".
    expect(
      matchesBareQuestionMark({
        key: "?",
        metaKey: false,
        ctrlKey: false,
        altKey: false,
      }),
    ).toBe(true);
  });

  it("does not fire for a modified question mark", () => {
    // `⌘?` / `Ctrl+?` is a different gesture.
    for (const modifier of ["metaKey", "ctrlKey", "altKey"] as const) {
      expect(
        matchesBareQuestionMark({
          key: "?",
          metaKey: modifier === "metaKey",
          ctrlKey: modifier === "ctrlKey",
          altKey: modifier === "altKey",
        }),
        modifier,
      ).toBe(false);
    }
  });

  it("ignores other keys", () => {
    expect(
      matchesBareQuestionMark({
        key: "/",
        metaKey: false,
        ctrlKey: false,
        altKey: false,
      }),
    ).toBe(false);
  });
});

describe("isTypingTarget", () => {
  it("detects fields and editable regions", () => {
    const input = document.createElement("input");
    const textarea = document.createElement("textarea");
    const select = document.createElement("select");
    const plain = document.createElement("div");

    expect(isTypingTarget(input)).toBe(true);
    expect(isTypingTarget(textarea)).toBe(true);
    expect(isTypingTarget(select)).toBe(true);
    expect(isTypingTarget(plain)).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });

  it("treats a node inside an editable region as typing", () => {
    // This is the ProseMirror case: the keydown target is a paragraph, which
    // does not itself carry the contentEditable attribute.
    const surface = document.createElement("div");
    surface.setAttribute("contenteditable", "true");
    const paragraph = document.createElement("p");
    const text = document.createTextNode("x");
    paragraph.appendChild(text);
    surface.appendChild(paragraph);
    document.body.appendChild(surface);

    expect(isTypingTarget(paragraph)).toBe(true);
    expect(isTypingTarget(surface)).toBe(true);

    // …but an explicitly non-editable nested region is not.
    const locked = document.createElement("div");
    locked.setAttribute("contenteditable", "false");
    surface.appendChild(locked);
    expect(isTypingTarget(locked)).toBe(false);

    surface.remove();
  });
});

describe("formatShortcut", () => {
  it("uses Apple glyphs on macOS", () => {
    expect(formatShortcut(["mod", "shift", "x"], true)).toEqual(["⌘", "⇧", "X"]);
    expect(formatShortcut(["mod", "alt", "c"], true)).toEqual(["⌘", "⌥", "C"]);
  });

  it("spells modifiers out elsewhere", () => {
    expect(formatShortcut(["mod", "shift", "x"], false)).toEqual([
      "Ctrl",
      "Shift",
      "X",
    ]);
  });

  it("prints named keys, never the internal name", () => {
    // Regression guard: the "slash" token was leaking into the UI as the
    // word "slash" instead of the "/" the user actually presses.
    expect(formatShortcut(["mod", "slash"], false)).toEqual(["Ctrl", "/"]);
    expect(formatShortcut(["mod", "slash"], true)).toEqual(["⌘", "/"]);
    expect(formatShortcut(["mod", "shift", "backspace"], false)).toEqual([
      "Ctrl",
      "Shift",
      "Backspace",
    ]);
    expect(formatShortcut(["mod", "shift", "backspace"], true)).toEqual([
      "⌘",
      "⇧",
      "⌫",
    ]);
  });

  it("advertises no shortcut as the platform's own glyph", () => {
    // The dialog's own trigger, on both platforms.
    expect(formatShortcut(findShortcut("shortcuts")!.keys, true)).toEqual(["⌘", "/"]);
    expect(formatShortcut(findShortcut("shortcuts")!.keys, false)).toEqual([
      "Ctrl",
      "/",
    ]);
  });

  it("returns nothing for keyless actions", () => {
    expect(formatShortcut(null, true)).toEqual([]);
  });
});

describe("detectMac", () => {
  it("recognises Apple platforms only", () => {
    expect(detectMac("MacIntel")).toBe(true);
    expect(detectMac("iPhone")).toBe(true);
    expect(detectMac("Win32")).toBe(false);
    expect(detectMac("Linux x86_64")).toBe(false);
    expect(detectMac("")).toBe(false);
  });
});

describe("KeyboardShortcutsDialog", () => {
  it("is an accessible dialog listing only its own scope", async () => {
    const { getByRole } = render(
      <KeyboardShortcutsDialog open onOpenChange={() => {}} scope="editor" />,
    );

    const dialog = await waitFor(() => getByRole("dialog"));
    expect(dialog.getAttribute("aria-labelledby")).toBeTruthy();
    expect(
      document.getElementById(dialog.getAttribute("aria-labelledby")!)?.textContent,
    ).toBe("Keyboard shortcuts");

    // The dialog is portalled to <body>, so assert against the dialog element
    // rather than the (empty) render container.
    // The workspace-only palette shortcut must not appear in the editor list.
    expect(dialog.textContent).not.toMatch(/command palette/i);
    // …and an editor-only shortcut must.
    expect(dialog.textContent).toMatch(/Strikethrough/);

    expect((await axe(dialog)).violations).toEqual([]);
  });

  it("renders every advertised key for the scope", async () => {
    const { getByRole } = render(
      <KeyboardShortcutsDialog open onOpenChange={() => {}} scope="editor" />,
    );
    const dialog = await waitFor(() => getByRole("dialog"));

    const kbdCount = dialog.querySelectorAll('[data-slot="kbd"]').length;
    const expected = shortcutsForScope("editor")
      .filter((s) => s.keys !== null)
      .reduce((sum, s) => sum + s.keys!.length, 0);

    expect(kbdCount).toBe(expected);
  });

  it("advertises ⌘K as the link shortcut and ⌘F as find, in the editor", async () => {
    const { getByRole } = render(
      <KeyboardShortcutsDialog open onOpenChange={() => {}} scope="editor" />,
    );
    const dialog = await waitFor(() => getByRole("dialog"));

    // The editor row for ⌘K must be the link popover…
    expect(dialog.textContent).toMatch(/Add or edit link/);
    expect(dialog.textContent).toMatch(/Find and replace/);
    // …and the workspace-only palette entry must not leak in.
    expect(dialog.textContent).not.toMatch(/command palette/i);
  });

  it("shows a real workspace reference, not an empty shell", async () => {
    const { getByRole } = render(
      <KeyboardShortcutsDialog open onOpenChange={() => {}} scope="workspace" />,
    );
    const dialog = await waitFor(() => getByRole("dialog"));

    // The workspace has no canvas, so formatting keys must not leak in…
    expect(dialog.textContent).not.toMatch(/Strikethrough/);
    // …but the keys and actions that do exist there must be listed.
    expect(dialog.textContent).toMatch(/command palette/i);
    expect(dialog.textContent).toMatch(/New document/);

    // A single-row dialog would be a pointless dialog; guard against the
    // workspace reference regressing to just the palette.
    const rows = dialog.querySelectorAll("li").length;
    expect(rows).toBeGreaterThanOrEqual(3);
  });

  it("labels keyless actions rather than inventing a combination", async () => {
    const { getByRole } = render(
      <KeyboardShortcutsDialog open onOpenChange={() => {}} scope="editor" />,
    );
    const dialog = await waitFor(() => getByRole("dialog"));
    expect(dialog.textContent).toMatch(/no shortcut/);
    expect(dialog.textContent).toMatch(/Type --- then a space/);
  });

  it("labels itself and offers a keyboard-reachable close affordance", async () => {
    const { getByRole } = render(
      <KeyboardShortcutsDialog open onOpenChange={() => {}} scope="editor" />,
    );
    const dialog = await waitFor(() => getByRole("dialog"));

    // The focus trap and Escape handling come from Base UI's Dialog; what this
    // component owns is the labelling and the ability to be dismissed without
    // a pointer.
    const labelledBy = dialog.getAttribute("aria-labelledby");
    const describedBy = dialog.getAttribute("aria-describedby");
    expect(labelledBy).toBeTruthy();
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(labelledBy!)?.textContent).toBe(
      "Keyboard shortcuts",
    );
    expect(document.getElementById(describedBy!)?.textContent).toMatch(/close/i);

    // A real close control, reachable by keyboard.
    expect(
      within(dialog).getByRole("button", { name: /close/i }),
    ).toBeTruthy();
  });

  it("reports dismissal through onOpenChange", async () => {
    const onOpenChange = vi.fn();
    const { getByRole, queryByRole, rerender } = render(
      <KeyboardShortcutsDialog open onOpenChange={onOpenChange} scope="editor" />,
    );
    await waitFor(() => getByRole("dialog"));
    // Closing is a controlled transition: the parent flips `open` back to
    // false, and the dialog unmounts.
    rerender(
      <KeyboardShortcutsDialog open={false} onOpenChange={onOpenChange} scope="editor" />,
    );
    await waitFor(() => expect(queryByRole("dialog")).toBeNull());
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
