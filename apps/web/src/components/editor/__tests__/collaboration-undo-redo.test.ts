// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import * as Y from "yjs";
import { UndoGranularity } from "@/lib/editor/undo-granularity-extension";
import { shortcutsForScope } from "@/lib/keyboard/shortcuts";
import { COMMANDS } from "@/components/editor/editor-keyboard-shortcuts";

describe("collaboration undo/redo", () => {
  it("tracks undo and redo stacks for local edits with can() queries", () => {
    const doc = new Y.Doc();
    const editor = new Editor({
      extensions: [
        StarterKit.configure({ undoRedo: false }),
        Collaboration.configure({ document: doc }),
      ],
    });

    expect(editor.can().undo()).toBe(false);
    expect(editor.can().redo()).toBe(false);

    // Insert content
    editor.commands.insertContent("Hello collaborative world");
    expect(editor.getText()).toBe("Hello collaborative world");
    expect(editor.can().undo()).toBe(true);
    expect(editor.can().redo()).toBe(false);

    // Undo via chained command
    editor.chain().focus().undo().run();
    expect(editor.getText()).toBe("");
    expect(editor.can().undo()).toBe(false);
    expect(editor.can().redo()).toBe(true);

    // Redo via chained command
    editor.chain().focus().redo().run();
    expect(editor.getText()).toBe("Hello collaborative world");
    expect(editor.can().undo()).toBe(true);
    expect(editor.can().redo()).toBe(false);

    editor.destroy();
  });

  it("undoes and redoes word by word when UndoGranularity is active", () => {
    const doc = new Y.Doc();
    const editor = new Editor({
      extensions: [
        StarterKit.configure({ undoRedo: false }),
        Collaboration.configure({ document: doc }),
        UndoGranularity,
      ],
    });

    // Simulate typing "Hello world" word by word:
    // 1. Type "Hello"
    editor.commands.insertContent("Hello");
    // 2. Type " " (space boundary)
    editor.commands.insertContent(" ");
    // 3. Type "world"
    editor.commands.insertContent("world");

    expect(editor.getText()).toBe("Hello world");

    // First undo should undo ONLY "world", NOT the whole line!
    editor.commands.undo();
    expect(editor.getText()).toBe("Hello ");

    // Second undo should undo "Hello "
    editor.commands.undo();
    expect(editor.getText()).toBe("");

    // First redo should restore "Hello "
    editor.commands.redo();
    expect(editor.getText()).toBe("Hello ");

    // Second redo should restore "world"
    editor.commands.redo();
    expect(editor.getText()).toBe("Hello world");

    editor.destroy();
  });

  it("handles punctuation and paragraph boundaries as separate undo steps", () => {
    const doc = new Y.Doc();
    const editor = new Editor({
      extensions: [
        StarterKit.configure({ undoRedo: false }),
        Collaboration.configure({ document: doc }),
        UndoGranularity,
      ],
    });

    // 1. Type "First"
    editor.commands.insertContent("First");
    // 2. Type ", " (comma + space)
    editor.commands.insertContent(", ");
    // 3. Type "Second"
    editor.commands.insertContent("Second");

    expect(editor.getText()).toBe("First, Second");

    // Undo "Second"
    editor.commands.undo();
    expect(editor.getText()).toBe("First, ");

    // Undo ", " and "First"
    editor.commands.undo();
    expect(editor.getText()).toBe("");

    // Redo restores "First, "
    editor.commands.redo();
    expect(editor.getText()).toBe("First, ");

    // Redo restores "Second"
    editor.commands.redo();
    expect(editor.getText()).toBe("First, Second");

    editor.destroy();
  });

  it("does not undo remote collaborators' edits (CRDT-safe undo manager)", () => {
    const docA = new Y.Doc();
    const docB = new Y.Doc();

    const editorA = new Editor({
      extensions: [
        StarterKit.configure({ undoRedo: false }),
        Collaboration.configure({ document: docA }),
      ],
    });

    const editorB = new Editor({
      extensions: [
        StarterKit.configure({ undoRedo: false }),
        Collaboration.configure({ document: docB }),
      ],
    });

    // Bidirectional sync helper
    const sync = () => {
      const updateA = Y.encodeStateAsUpdate(docA);
      const updateB = Y.encodeStateAsUpdate(docB);
      Y.applyUpdate(docB, updateA);
      Y.applyUpdate(docA, updateB);
    };

    // User A types something
    editorA.commands.insertContent("Alice text. ");
    sync();
    expect(editorB.getText()).toBe("Alice text. ");

    // User B types something concurrently
    editorB.commands.insertContent("Bob text. ");
    sync();
    expect(editorA.getText()).toBe(editorB.getText());
    expect(editorA.getText()).toContain("Alice text. ");
    expect(editorA.getText()).toContain("Bob text. ");

    // User A hits undo. User A should ONLY undo Alice's text, NOT Bob's text!
    expect(editorA.can().undo()).toBe(true);
    editorA.commands.undo();
    sync();

    // Alice text is cleanly reverted, Bob text remains untouched in both editors
    expect(editorA.getText()).toBe("Bob text. ");
    expect(editorB.getText()).toBe("Bob text. ");
    expect(editorA.can().undo()).toBe(false);
    expect(editorA.can().redo()).toBe(true);

    // User A redoes: Alice text is restored alongside Bob text
    editorA.commands.redo();
    sync();

    expect(editorA.getText()).toContain("Alice text. ");
    expect(editorA.getText()).toContain("Bob text. ");
    expect(editorA.getText()).toBe(editorB.getText());

    // User B hits undo: Bob's text is reverted, Alice's text remains!
    expect(editorB.can().undo()).toBe(true);
    editorB.commands.undo();
    sync();

    expect(editorA.getText()).toBe("Alice text. ");
    expect(editorB.getText()).toBe("Alice text. ");

    editorA.destroy();
    editorB.destroy();
  });

  it("registers undo and redo in the editor shortcut registry and command map", () => {
    const editorShortcuts = shortcutsForScope("editor");

    const undoShortcut = editorShortcuts.find((s) => s.id === "undo");
    const redoShortcut = editorShortcuts.find((s) => s.id === "redo");

    expect(undoShortcut).toBeDefined();
    expect(undoShortcut?.label).toBe("Undo");
    expect(undoShortcut?.group).toBe("document");
    expect(undoShortcut?.keys).toEqual(["mod", "z"]);

    expect(redoShortcut).toBeDefined();
    expect(redoShortcut?.label).toBe("Redo");
    expect(redoShortcut?.group).toBe("document");
    expect(redoShortcut?.keys).toEqual(["mod", "shift", "z"]);

    expect(COMMANDS.undo).toBe("undo");
    expect(COMMANDS.redo).toBe("redo");
  });
});
