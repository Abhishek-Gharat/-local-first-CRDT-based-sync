// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { axe } from "vitest-axe";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { DocumentOutline } from "@/components/editor/document-outline";

// jsdom implements neither of these, and the outline does both.
const scrollCalls: unknown[] = [];
beforeAll(() => {
  Element.prototype.scrollIntoView = function scrollIntoView() {
    scrollCalls.push(this);
  };
  window.scrollTo = function scrollTo() {};
});

let editor: Editor | null = null;

function mount(content = "<h1>Title</h1><p>body</p><h2>Section</h2>") {
  const element = document.createElement("div");
  document.body.appendChild(element);
  editor = new Editor({
    element,
    extensions: [StarterKit.configure({ undoRedo: false })],
    content,
  });
  const result = render(<DocumentOutline editor={editor} />);
  fireEvent.click(screen.getByRole("button", { name: "Document outline" }));
  return result;
}

const popup = () => document.querySelector('[data-slot="popover-content"]') as HTMLElement;
const items = () => Array.from(popup().querySelectorAll("li button")) as HTMLElement[];

afterEach(() => {
  cleanup();
  editor?.destroy();
  editor = null;
  scrollCalls.length = 0;
  document.body.innerHTML = "";
});

describe("trigger", () => {
  it("is a labelled icon button that opens the popover", async () => {
    const { container } = render(<DocumentOutline editor={null} />);
    const trigger = screen.getByRole("button", { name: "Document outline" });
    expect(trigger).toBeTruthy();

    fireEvent.click(trigger);
    await waitFor(() => expect(popup()).toBeTruthy());
    expect(container).toBeTruthy();
  });
});

describe("outline contents", () => {
  it("lists each heading as its own button", async () => {
    mount();
    await waitFor(() => popup());
    expect(items().map((b) => b.textContent?.replace(/Heading level \d/, ""))).toEqual([
      "Title",
      "Section",
    ]);
  });

  it("indents deeper levels further", async () => {
    mount("<h1>One</h1><h2>Two</h2><h3>Three</h3>");
    await waitFor(() => popup());

    const [one, two, three] = items();
    const pad = (el: HTMLElement) =>
      Number.parseFloat(el.style.paddingLeft || "0");

    expect(pad(one!)).toBeLessThan(pad(two!));
    expect(pad(two!)).toBeLessThan(pad(three!));
  });

  it("announces each heading's level for screen-reader users", async () => {
    mount("<h1>One</h1><h2>Two</h2>");
    await waitFor(() => popup());

    // The indentation is visual only, so the level has to be in the name.
    expect(items()[0]!.textContent).toContain("Heading level 1");
    expect(items()[1]!.textContent).toContain("Heading level 2");
  });

  it("exposes the outline as a named navigation landmark", async () => {
    mount();
    await waitFor(() => popup());
    const nav = screen.getByRole("navigation", { name: "Document outline" });
    expect(nav).toBeTruthy();
  });

  it("updates live when a heading is added", async () => {
    mount("<h1>Title</h1>");
    await waitFor(() => popup());
    expect(items()).toHaveLength(1);

    editor!.commands.insertContentAt(editor!.state.doc.content.size, "<h2>Fresh</h2>");

    await waitFor(() =>
      expect(items().map((b) => b.textContent)).toContain("FreshHeading level 2"),
    );
  });

  it("updates live when a heading is renamed", async () => {
    mount("<h1>Before</h1>");
    await waitFor(() => popup());

    editor!.commands.setContent("<h1>After</h1>");

    await waitFor(() => expect(popup().textContent).toContain("After"));
    expect(popup().textContent).not.toContain("Before");
  });

  it("shows the empty state, and the shortcut that fixes it", async () => {
    mount("<p>no headings here</p>");
    await waitFor(() => popup());

    expect(popup().textContent).toMatch(/No headings yet/);
    // The hint names a real shortcut, platform-aware.
    expect(popup().textContent).toMatch(/Ctrl|⌘/);
    expect(popup().textContent).toMatch(/1/);
  });

  it("returns to the empty state when the last heading is removed", async () => {
    mount("<h1>Only</h1>");
    await waitFor(() => popup());
    expect(items()).toHaveLength(1);

    editor!.commands.setContent("<p>gone</p>");
    await waitFor(() => expect(popup().textContent).toMatch(/No headings yet/));
  });
});

describe("navigation", () => {
  it("scrolls to the heading and closes the popover", async () => {
    mount();
    await waitFor(() => popup());

    fireEvent.click(items()[1]!);

    await waitFor(() => expect(scrollCalls.length).toBe(1));
    await waitFor(() => expect(document.querySelector('[data-slot="popover-content"]')).toBeNull());
  });

  it("scrolls the right heading", async () => {
    mount("<h1>Alpha</h1><h2>Beta</h2>");
    await waitFor(() => popup());

    fireEvent.click(items()[1]!);

    await waitFor(() => expect(scrollCalls).toHaveLength(1));
    const scrolled = scrollCalls[0] as HTMLElement;
    expect(scrolled.tagName).toBe("H2");
    expect(scrolled.textContent).toBe("Beta");
  });

  it("does not mutate the document or move the caret", async () => {
    // Deliberately ends in a heading: Tiptap's `focus()` normalises that into a
    // trailing empty paragraph, which is exactly the kind of invisible
    // collaborative edit the outline must not cause.
    mount("<h1>Alpha</h1><p>body</p><h2>Beta</h2>");
    await waitFor(() => popup());

    const before = editor!.getHTML();
    const caret = editor!.state.selection.from;
    expect(before).not.toMatch(/<p><\/p>$/);

    for (const item of items()) fireEvent.click(item);

    expect(editor!.getHTML()).toBe(before);
    // The selection is shared CRDT state; scrolling must not move it.
    expect(editor!.state.selection.from).toBe(caret);
  });
});

describe("active heading", () => {
  it("marks the first heading as current when the reader is at the top", async () => {
    // jsdom reports every heading at the same rect, so stub the geometry to
    // place the first one above the reading line and the rest below it.
    mount("<h1>Alpha</h1><h2>Beta</h2><h2>Gamma</h2>");
    await waitFor(() => popup());

    const headings = Array.from(
      document.querySelectorAll(".ProseMirror h1, .ProseMirror h2"),
    ) as HTMLElement[];
    const tops = [-400, 400, 900];
    headings.forEach((el, i) => {
      el.getBoundingClientRect = () => ({ top: tops[i] }) as DOMRect;
    });
    window.dispatchEvent(new Event("scroll"));

    await waitFor(() =>
      expect(items()[0]!.getAttribute("aria-current")).toBe("true"),
    );
    expect(items()[1]!.getAttribute("aria-current")).toBeNull();
    expect(items()[2]!.getAttribute("aria-current")).toBeNull();
  });

  it("moves the current heading as the reader scrolls down", async () => {
    mount("<h1>Alpha</h1><h2>Beta</h2><h2>Gamma</h2>");
    await waitFor(() => popup());

    const headings = Array.from(
      document.querySelectorAll(".ProseMirror h1, .ProseMirror h2"),
    ) as HTMLElement[];
    let tops = [-400, 400, 900];
    const apply = () =>
      headings.forEach((el, i) => {
        el.getBoundingClientRect = () => ({ top: tops[i] }) as DOMRect;
      });
    apply();
    window.dispatchEvent(new Event("scroll"));
    await waitFor(() => expect(items()[0]!.getAttribute("aria-current")).toBe("true"));

    // Scroll past the second heading.
    tops = [-400, -100, 900];
    apply();
    window.dispatchEvent(new Event("scroll"));

    await waitFor(() => expect(items()[1]!.getAttribute("aria-current")).toBe("true"));
    expect(items()[0]!.getAttribute("aria-current")).toBeNull();
  });
});

describe("accessibility", () => {
  it("has no detectable violations when open", async () => {
    mount();
    await waitFor(() => popup());
    expect((await axe(popup())).violations).toEqual([]);
  });

  it("has no detectable violations in the empty state", async () => {
    mount("<p>nothing</p>");
    await waitFor(() => popup());
    expect((await axe(popup())).violations).toEqual([]);
  });

  it("gives every outline entry an accessible name", async () => {
    mount("<h1>Alpha</h1><h2>Beta</h2>");
    await waitFor(() => popup());

    for (const item of items()) {
      const name = (item.textContent ?? "").trim();
      expect(name.length, "outline entry without a name").toBeGreaterThan(0);
      expect(item.tagName).toBe("BUTTON");
      expect(item.getAttribute("type")).toBe("button");
    }
  });
});
