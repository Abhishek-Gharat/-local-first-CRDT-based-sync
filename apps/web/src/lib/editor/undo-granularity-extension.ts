import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { yUndoPluginKey } from "@tiptap/y-tiptap";

const WORD_BOUNDARY_REGEX = /[ \t\n\r\u00A0.,!?;:()\[\]{}"'“”‘’<>\-–—\/\\=+\*]/;

export interface UndoGranularityOptions {
  /**
   * Additional boundary pattern or override.
   */
  boundaryPattern?: RegExp;
}

/**
 * Granular Word-by-Word Undo/Redo Extension for Collaborative Tiptap/Yjs.
 *
 * Why this is needed:
 * By default, Y.UndoManager merges all local transactions that occur within
 * `captureTimeout` (500ms). When typing at standard typing speed, every character
 * arrives within 150-300ms, causing an entire line or multi-sentence paragraph to
 * merge into a single `StackItem`. As a result, pressing Undo or Redo reverts or
 * restores the entire line at once.
 *
 * This extension monitors typing boundaries (spaces, punctuation, enters,
 * and operation transitions between typing and deleting). When a word boundary
 * is completed, it invokes `undoManager.stopCapturing()`, closing the current
 * undo item so subsequent typing begins a fresh, granular stack item.
 */
export const UndoGranularity = Extension.create<UndoGranularityOptions>({
  name: "undoGranularity",

  // Lower priority than Collaboration (priority 1000) so this plugin's view.update()
  // runs immediately after ySyncPlugin has synced the transaction to Yjs.
  priority: 100,

  addOptions() {
    return {
      boundaryPattern: WORD_BOUNDARY_REGEX,
    };
  },

  addProseMirrorPlugins() {
    const boundaryPattern = this.options.boundaryPattern ?? WORD_BOUNDARY_REGEX;

    return [
      new Plugin({
        key: new PluginKey("undoGranularity"),
        view() {
          let lastOperation: "insert" | "delete" | null = null;
          let lastParentPos: number | null = null;

          return {
            update(view, prevState) {
              if (prevState.doc.eq(view.state.doc)) {
                return;
              }

              const yUndoState = yUndoPluginKey.getState(view.state);
              const undoManager = yUndoState?.undoManager;
              if (!undoManager) return;

              // Never interfere while an undo or redo replay is actively in flight
              if (undoManager.undoing || undoManager.redoing) return;

              const prevSize = prevState.doc.content.size;
              const currentSize = view.state.doc.content.size;
              const currentOperation: "insert" | "delete" =
                currentSize >= prevSize ? "insert" : "delete";

              // 1. Operation switch (e.g. typing -> backspacing or backspacing -> typing)
              if (lastOperation !== null && lastOperation !== currentOperation) {
                undoManager.stopCapturing();
                lastOperation = currentOperation;
                return;
              }
              lastOperation = currentOperation;

              const { selection } = view.state;
              if (selection.empty) {
                const pos = selection.from;
                const parentPos = selection.$from.before();

                // 2. Block/paragraph transition (e.g. user pressed Enter to start a new line)
                if (lastParentPos !== null && lastParentPos !== parentPos) {
                  undoManager.stopCapturing();
                  lastParentPos = parentPos;
                  return;
                }
                lastParentPos = parentPos;

                // 3. Word boundary character typed (space, tab, punctuation)
                if (pos > 0) {
                  const charBefore = view.state.doc.textBetween(
                    Math.max(0, pos - 1),
                    pos,
                  );
                  if (boundaryPattern.test(charBefore)) {
                    undoManager.stopCapturing();
                  }
                }
              }
            },
          };
        },
      }),
    ];
  },
});
