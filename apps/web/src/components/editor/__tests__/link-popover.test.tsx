// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { axe } from "vitest-axe";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { LinkPopover } from "@/components/editor/link-popover";
import {
  requestLinkPopover,
  resetLinkPopoverBridge,
} from "@/components/editor/link-popover-bridge";

/**
 * jsdom has no layout engine, so ProseMirror's scroll-into-view path throws
 * `getClientRects is not a function` whenever a command focuses the editor.
 * The popover focuses the canvas on purpose (on open and on close), so these
 * land as unhandled errors on every test. Stubbing the measurement APIs keeps
 * unrelated errors from drowning the run.
 */
beforeAll(() => {
  const emptyRectList = () =>
    Object.assign([], { item: () => null }) as unknown as DOMRectList;
  const emptyRect = () => new DOMRect();

  Range.prototype.getClientRects = emptyRectList;
  Range.prototype.getBoundingClientRect = emptyRect;
  Element.prototype.getClientRects = emptyRectList;
  Element.prototype.getBoundingClientRect = emptyRect;
});

function makeEditor(content: string): Editor {
  const element = document.createElement("div");
  document.body.appendChild(element);
  return new Editor({
    element,
    extensions: [
      StarterKit.configure({
        undoRedo: false,
        link: { openOnClick: false, defaultProtocol: "https" },
      }),
    ],
    content,
  });
}

/** The popover content, which Base UI portals to <body>. */
function popup(): HTMLElement {
  const found = document.querySelector('[data-slot="popover-content"]');
  if (!(found instanceof HTMLElement)) throw new Error("popover is not open");
  return found;
}

let editor: Editor | null = null;

function mount(content = "<p>alpha beta</p>") {
  editor = makeEditor(content);
  const result = render(<LinkPopover editor={editor} />);
  return { ...result, editor };
}

afterEach(() => {
  cleanup();
  resetLinkPopoverBridge();
  editor?.destroy();
  editor = null;
  document.body.innerHTML = "";
});

describe("LinkPopover trigger", () => {
  it("is a labelled toggle that reflects whether a link is active", async () => {
    const { editor: e } = mount('<p><a href="https://example.com">alpha</a> beta</p>');
    e.commands.setTextSelection(2); // inside the link

    await waitFor(() => {
      const trigger = screen.getByRole("button", { name: "Link" });
      expect(trigger.getAttribute("aria-pressed")).toBe("true");
    });

    e.commands.setTextSelection(9); // inside "beta"
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Link" }).getAttribute("aria-pressed"),
      ).toBe("false");
    });
  });
});

describe("LinkPopover — add", () => {
  it("opens with a labelled, empty, auto-focused field", async () => {
    mount();
    requestLinkPopover();

    await waitFor(() => popup());
    const field = within(popup()).getByPlaceholderText("https://example.com") as HTMLInputElement;
    expect(field).toBeTruthy();
    // The label is a real <label for>, not a placeholder standing in for one.
    const label = document.querySelector(`label[for="${field.id}"]`);
    expect(label?.textContent?.toLowerCase()).toContain("add link");
    await waitFor(() => expect(document.activeElement).toBe(field));
  });

  it("disables Apply until there is something to apply", async () => {
    mount();
    requestLinkPopover();
    await waitFor(() => popup());

    const apply = within(popup()).getByRole("button", { name: "Apply" });
    expect(apply.hasAttribute("disabled")).toBe(true);

    const field = within(popup()).getByPlaceholderText("https://example.com");
    fireEvent.change(field, { target: { value: "example.com" } });
    await waitFor(() =>
      expect(
        within(popup()).getByRole("button", { name: "Apply" }).hasAttribute("disabled"),
      ).toBe(false),
    );
  });

  it("refuses a script URL instead of writing it into the document", async () => {
    const { editor: e } = mount();
    requestLinkPopover();
    await waitFor(() => popup());

    const field = within(popup()).getByPlaceholderText("https://example.com");
    fireEvent.change(field, { target: { value: "javascript:alert(1)" } });

    const apply = within(popup()).getByRole("button", { name: "Apply" });
    await waitFor(() => expect(apply.hasAttribute("disabled")).toBe(true));
    // The problem is announced, not just implied by a greyed-out button.
    expect(within(popup()).getByRole("alert").textContent).toMatch(/isn't allowed/);
    expect(e.getHTML()).not.toContain("javascript:");
  });

  it("applies a normalized href to the selection the popover prepared", async () => {
    const { editor: e } = mount("<p>alpha beta</p>");
    e.commands.setTextSelection(2); // caret inside "alpha"
    requestLinkPopover();
    await waitFor(() => popup());

    const field = within(popup()).getByPlaceholderText("https://example.com");
    fireEvent.change(field, { target: { value: "example.com" } });
    fireEvent.click(within(popup()).getByRole("button", { name: "Apply" }));

    await waitFor(() => expect(e.getHTML()).toContain("https://example.com"));
    // A bare host must be upgraded, not stored as a relative path.
    expect(e.getHTML()).not.toContain('href="example.com"');
    expect(e.getHTML()).toMatch(/<a [^>]*>alpha<\/a>/);
  });

  it("applies on Enter, since that is what people try first", async () => {
    const { editor: e } = mount("<p>alpha beta</p>");
    e.commands.setTextSelection(2);
    requestLinkPopover();
    await waitFor(() => popup());

    const field = within(popup()).getByPlaceholderText("https://example.com");
    fireEvent.change(field, { target: { value: "https://example.com" } });
    fireEvent.submit(field.closest("form")!);

    await waitFor(() => expect(e.getHTML()).toContain("https://example.com"));
  });
});

describe("LinkPopover — view and edit", () => {
  const linked = '<p>go <a href="https://example.com/docs">to the docs</a></p>';

  it("shows the current URL with an external open affordance", async () => {
    mount(linked);
    editor!.commands.setTextSelection(6);
    requestLinkPopover();

    await waitFor(() => popup());
    const open = within(popup()).getByRole("link");
    expect(open.getAttribute("href")).toBe("https://example.com/docs");
    expect(open.getAttribute("target")).toBe("_blank");
    // noopener keeps the opened page from reaching back through window.opener.
    expect(open.getAttribute("rel")).toContain("noopener");
    expect(within(popup()).getByRole("button", { name: /remove link/i })).toBeTruthy();
  });

  it("switches to a field on Edit, prefilled with the current address", async () => {
    mount(linked);
    editor!.commands.setTextSelection(6);
    requestLinkPopover();
    await waitFor(() => popup());

    fireEvent.click(within(popup()).getByRole("button", { name: "Edit" }));
    await waitFor(() => {
      const field = within(popup()).getByPlaceholderText("https://example.com") as HTMLInputElement;
      expect(field.value).toBe("https://example.com/docs");
    });
  });

  it("replaces the link rather than nesting a second one", async () => {
    const { editor: e } = mount(linked);
    e.commands.setTextSelection(6);
    requestLinkPopover();
    await waitFor(() => popup());

    fireEvent.click(within(popup()).getByRole("button", { name: "Edit" }));
    const field = await waitFor(() =>
      within(popup()).getByPlaceholderText("https://example.com") as HTMLInputElement,
    );
    fireEvent.change(field, { target: { value: "https://new.example.com" } });
    fireEvent.click(within(popup()).getByRole("button", { name: "Apply" }));

    await waitFor(() => expect(e.getHTML()).toContain("https://new.example.com"));
    expect(e.getHTML()).not.toContain("https://example.com/docs");
    // Exactly one anchor, not one nested inside another.
    expect(e.getHTML().match(/<a /g)).toHaveLength(1);
  });

  it("removes the link and keeps the text", async () => {
    const { editor: e } = mount(linked);
    e.commands.setTextSelection(6);
    requestLinkPopover();
    await waitFor(() => popup());

    fireEvent.click(within(popup()).getByRole("button", { name: /remove link/i }));

    await waitFor(() => expect(e.getHTML()).not.toContain("<a "));
    // Removing the link must not remove the words it was attached to.
    expect(e.getHTML()).toContain("to the docs");
  });
});

describe("LinkPopover accessibility", () => {
  it("has no detectable violations when adding a link", async () => {
    mount();
    requestLinkPopover();
    await waitFor(() => popup());

    expect((await axe(popup())).violations).toEqual([]);
  });

  it("has no detectable violations when viewing an existing link", async () => {
    mount('<p>go <a href="https://example.com">docs</a></p>');
    editor!.commands.setTextSelection(4);
    requestLinkPopover();
    await waitFor(() => popup());

    expect((await axe(popup())).violations).toEqual([]);
  });

  it("links the error message to the field that caused it", async () => {
    mount();
    requestLinkPopover();
    await waitFor(() => popup());

    const field = within(popup()).getByPlaceholderText("https://example.com");
    fireEvent.change(field, { target: { value: "https://" } });

    await waitFor(() => expect(field.getAttribute("aria-invalid")).toBe("true"));
    const describedBy = field.getAttribute("aria-describedby")!;
    const message = document.getElementById(describedBy);
    expect(message?.getAttribute("role")).toBe("alert");
  });

  it("returns focus to the canvas when it closes", async () => {
    const { editor: e } = mount("<p>alpha beta</p>");
    e.commands.setTextSelection(2);
    requestLinkPopover();
    await waitFor(() => popup());

    const field = within(popup()).getByPlaceholderText("https://example.com");
    fireEvent.change(field, { target: { value: "https://example.com" } });
    fireEvent.click(within(popup()).getByRole("button", { name: "Apply" }));

    await waitFor(() => expect(popupSafe()).toBe(false));
    await waitFor(() => expect(e.isFocused).toBe(true));
  });
});

function popupSafe(): boolean {
  return !!document.querySelector('[data-slot="popover-content"]');
}

describe("LinkPopover is inert without a mount", () => {
  it("does not throw when a shortcut fires with no popover mounted", () => {
    const spy = vi.fn();
    resetLinkPopoverBridge();
    requestLinkPopover();
    expect(spy).not.toHaveBeenCalled();
  });
});
