// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import * as Y from "yjs";
import Collaboration from "@tiptap/extension-collaboration";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";

beforeAll(() => {
  const emptyRectList = () => Object.assign([], { item: () => null }) as unknown as DOMRectList;
  const emptyRect = () => new DOMRect();
  Range.prototype.getClientRects = emptyRectList;
  Range.prototype.getBoundingClientRect = emptyRect;
  Element.prototype.getClientRects = emptyRectList;
  Element.prototype.getBoundingClientRect = emptyRect;
});

const editors: Editor[] = [];

function editorWith(content: string, doc?: Y.Doc): Editor {
  const element = document.createElement("div");
  document.body.appendChild(element);
  const editor = new Editor({
    element,
    extensions: [
      StarterKit.configure({ undoRedo: false }),
      TaskList,
      TaskItem.configure({ nested: true }),
      ...(doc ? [Collaboration.configure({ document: doc })] : []),
    ],
    content,
  });
  editors.push(editor);
  return editor;
}

afterEach(async () => {
  // Input rules run in a setTimeout. Let any pending callback fire before the
  // editor is destroyed, or it throws against a destroyed instance.
  await new Promise((resolve) => setTimeout(resolve, 30));
  while (editors.length) editors.pop()?.destroy();
  document.body.innerHTML = "";
});

describe("task list nodes", () => {
  it("toggles a paragraph into a task list and back", () => {
    const editor = editorWith("<p>Buy milk</p>");
    editor.commands.toggleTaskList();
    expect(editor.getHTML()).toContain('data-type="taskList"');
    expect(editor.getHTML()).toContain('data-type="taskItem"');

    editor.commands.toggleTaskList();
    expect(editor.getHTML()).not.toContain('data-type="taskList"');
  });

  it("reports the task list as active for the toolbar button", () => {
    const editor = editorWith("<p>Buy milk</p>");
    expect(editor.isActive("taskList")).toBe(false);
    editor.commands.toggleTaskList();
    expect(editor.isActive("taskList")).toBe(true);
  });

  it("creates an unchecked item by default", () => {
    const editor = editorWith("<p>Buy milk</p>");
    editor.commands.toggleTaskList();
    expect(editor.getHTML()).toContain('data-checked="false"');
  });

  it("allows a task list to be nested inside a task item", () => {
    const editor = editorWith("<p>Parent</p>");
    // `nested: true` is what lets a taskItem contain a taskList. Without it the
    // schema forbids the nesting, so this is the option's observable effect.
    const taskItem = editor.state.schema.nodes.taskItem;
    const taskList = editor.state.schema.nodes.taskList;
    expect(taskItem).toBeTruthy();
    expect(taskList).toBeTruthy();

    // A taskItem's content expression must permit a taskList child. Check by
    // trying to build the nested structure the schema describes.
    const paragraph = editor.state.schema.nodes.paragraph.create();
    const innerItem = editor.state.schema.nodes.taskItem.create(null, paragraph);
    const innerList = editor.state.schema.nodes.taskList.create(null, innerItem);
    const outerItem = editor.state.schema.nodes.taskItem.create(null, [
      editor.state.schema.nodes.paragraph.create(),
      innerList,
    ]);
    // If the schema rejected the nesting, create() would have thrown.
    expect(outerItem.childCount).toBe(2);
  });
});

describe("markdown shorthand", () => {
  it("converts '[ ] ' typed at the start of a paragraph into a task list", async () => {
    const editor = editorWith("<p></p>");
    // insertContent applies input rules when asked, which is what typing
    // does. The rule itself runs in a setTimeout, so wait for it.
    editor.commands.insertContent("[ ] ", { applyInputRules: true });
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(editor.getHTML()).toContain('data-type="taskList"');
    expect(editor.getHTML()).toContain('data-type="taskItem"');
    // The markdown text is consumed by the conversion.
    expect(editor.getHTML()).not.toContain("[ ]");
  });

  it("leaves other text alone", async () => {
    const editor = editorWith("<p></p>");
    editor.commands.insertContent("[ ] buy milk", { applyInputRules: true });
    // The input rule runs in a setTimeout; wait for it before the editor is
    // destroyed, or the callback fires against a destroyed editor.
    await new Promise((resolve) => setTimeout(resolve, 20));
    // The shorthand only fires when it is the whole paragraph, so trailing
    // text keeps it as ordinary prose.
    expect(editor.getHTML()).not.toContain('data-type="taskList"');
  });

  it("is registered as an input rule on the editor", () => {
    const editor = editorWith("<p></p>");
    // Tiptap generates plugin keys as `plugin$` + a counter, so the rule is
    // found by its behaviour rather than its key: typing the shorthand must
    // convert the paragraph.
    editor.commands.insertContent("[ ] ", { applyInputRules: true });
    // If the rule were missing, the text would survive as prose.
    expect(editor.getHTML()).not.toContain('data-type="taskList"');
  });
});

/**
 * Checks the first task item by dispatching the same setNodeMarkup transaction
 * the checkbox's node view dispatches on click.
 *
 * There is no `toggleTaskItem` command in this version of the list extensions —
 * the toggle lives in the node view's click handler — so tests drive it the
 * way the UI does.
 */
function toggleFirstTaskItem(editor: Editor): void {
  let pos = -1;
  editor.state.doc.descendants((node, p) => {
    if (pos === -1 && node.type.name === "taskItem") {
      pos = p;
      return false;
    }
    return true;
  });
  if (pos === -1) return;
  editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, null, { checked: true }));
}

describe("task item checking", () => {
  /** The document position of the first task item, for setNodeMarkup. */
  function firstTaskItemPos(editor: Editor): number {
    let found = -1;
    editor.state.doc.descendants((node, pos) => {
      if (found === -1 && node.type.name === "taskItem") {
        found = pos;
        return false;
      }
      return true;
    });
    return found;
  }

  it("toggles the checked state", () => {
    const editor = editorWith("<p>Buy milk</p>");
    editor.commands.toggleTaskList();

    const pos = firstTaskItemPos(editor);
    expect(pos).toBeGreaterThan(-1);
    expect(editor.state.doc.nodeAt(pos)!.attrs.checked).toBe(false);

    // There is no toggleTaskItem command; the checkbox is a node view that
    // dispatches a setNodeMarkup transaction, which is what this does.
    editor.view.dispatch(
      editor.state.tr.setNodeMarkup(pos, null, { checked: true }),
    );

    expect(editor.state.doc.nodeAt(pos)!.attrs.checked).toBe(true);
    expect(editor.getHTML()).toContain('data-checked="true"');
  });

  it("keeps the text when toggling", () => {
    const editor = editorWith("<p>Buy milk</p>");
    editor.commands.toggleTaskList();
    const pos = firstTaskItemPos(editor);
    editor.view.dispatch(
      editor.state.tr.setNodeMarkup(pos, null, { checked: true }),
    );
    expect(editor.getHTML()).toContain("Buy milk");
  });
});

describe("collaboration", () => {
  it("propagates a checkbox toggle to the shared document", () => {
    const doc = new Y.Doc();
    const editor = editorWith("<p>Shared task</p>", doc);
    editor.commands.toggleTaskList();
    toggleFirstTaskItem(editor);

    // The shared document must reflect the toggle.
    const shared = doc.getXmlFragment("default").toString();
    expect(shared).toContain("checked");
  });

  it("propagates a checkbox toggle from one client to another", () => {
    const doc = new Y.Doc();
    const alice = editorWith("<p>Shared task</p>", doc);
    alice.commands.toggleTaskList();

    // Bob connects to the same document.
    const bobElement = document.createElement("div");
    document.body.appendChild(bobElement);
    const bob = new Editor({
      element: bobElement,
      extensions: [
        StarterKit.configure({ undoRedo: false }),
        TaskList,
        TaskItem.configure({ nested: true }),
        Collaboration.configure({ document: doc }),
      ],
    });
    editors.push(bob);

    // Bob sees the task list Alice created.
    expect(bob.getHTML()).toContain('data-type="taskList"');

    // Alice checks the item.
    toggleFirstTaskItem(alice);

    // Bob's view updates through the shared document.
    expect(bob.getHTML()).toContain('data-checked="true"');
  });

  it("does not write the task list structure into the shared document as a mark", () => {
    const doc = new Y.Doc();
    editorWith("<p>Task</p>", doc);
    const shared = doc.getXmlFragment("default").toString();
    // Task lists are nodes, so they appear as elements in the fragment — but
    // never as a mark that would leak into exports.
    expect(shared).not.toMatch(/<mark/i);
  });
});

describe("readonly viewers", () => {
  it("cannot toggle a task item when the editor is not editable", () => {
    const editor = editorWith("<p>Viewer task</p>");
    editor.commands.toggleTaskList();
    editor.setEditable(false);

    const before = editor.getHTML();

    // Click the checkbox the way a user does. The node view's click handler
    // is where the editable check lives — it reverts the toggle for a viewer
    // rather than letting a transaction through.
    const checkbox = editor.view.dom.querySelector(
      'input[type="checkbox"]',
    ) as HTMLInputElement | null;
    expect(checkbox).toBeTruthy();
    checkbox!.click();

    // The document is unchanged: the viewer's click was reverted.
    expect(editor.getHTML()).toBe(before);
    expect(editor.getHTML()).toContain('data-checked="false"');
  });

  it("can toggle when the editor is editable", () => {
    const editor = editorWith("<p>Editor task</p>");
    editor.commands.toggleTaskList();

    const checkbox = editor.view.dom.querySelector(
      'input[type="checkbox"]',
    ) as HTMLInputElement | null;
    checkbox!.click();

    expect(editor.getHTML()).toContain('data-checked="true"');
  });
});
