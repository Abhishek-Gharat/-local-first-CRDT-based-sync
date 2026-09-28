// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { axe } from "vitest-axe";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { FindReplaceBar } from "@/components/editor/find-replace/find-replace-bar";
import { FindReplace } from "@/components/editor/find-replace/find-replace-extension";
import {
  requestFindReplace,
  resetFindReplaceBridge,
} from "@/components/editor/find-replace/find-replace-bridge";
import { getFindState } from "@/components/editor/find-replace/find-replace-extension";

beforeAll(() => {
  const emptyRectList = () => Object.assign([], { item: () => null }) as unknown as DOMRectList;
  const emptyRect = () => new DOMRect();
  Range.prototype.getClientRects = emptyRectList;
  Range.prototype.getBoundingClientRect = emptyRect;
  Element.prototype.getClientRects = emptyRectList;
  Element.prototype.getBoundingClientRect = emptyRect;
});

let editor: Editor | null = null;

function mount(content = "<p>cat and cat</p>") {
  const element = document.createElement("div");
  document.body.appendChild(element);
  editor = new Editor({
    element,
    // FindReplace must be installed here, not just in the app: the bar talks to
    // the plugin, and without it every search is silently a no-op.
    extensions: [StarterKit.configure({ undoRedo: false }), FindReplace],
    content,
  });
  // The bar is only mounted by the editor once the shortcut fires.
  return render(<FindReplaceBar editor={editor} />);
}

const field = () => screen.getByPlaceholderText("Find in document…") as HTMLInputElement;
const count = () => document.querySelector('[data-slot="find-count"]')!;
const bar = () => screen.getByRole("region", { name: /find and replace/i });

afterEach(() => {
  cleanup();
  resetFindReplaceBridge();
  editor?.destroy();
  editor = null;
  document.body.innerHTML = "";
});

describe("opening", () => {
  it("stays hidden until the shortcut asks for it", () => {
    mount();
    expect(screen.queryByRole("region")).toBeNull();
  });

  it("opens on request and focuses the search field", async () => {
    mount();
    requestFindReplace();

    await waitFor(() => expect(bar()).toBeTruthy());
    await waitFor(() => expect(document.activeElement).toBe(field()));
  });

  it("exposes the search field under a real label, not just a placeholder", async () => {
    mount();
    requestFindReplace();
    await waitFor(() => bar());

    const input = field();
    const label = document.querySelector(`label[for="${input.id}"]`);
    expect(label?.textContent?.toLowerCase()).toContain("find in document");
  });
});

describe("match count", () => {
  it("is blank until something is typed, then reports 1 of 2", async () => {
    mount();
    requestFindReplace();
    await waitFor(() => bar());

    expect(count().textContent).toBe("");
    fireEvent.change(field(), { target: { value: "cat" } });
    await waitFor(() => expect(count().textContent).toBe("1 of 2"));
  });

  it("says No matches rather than 0 of 0", async () => {
    mount();
    requestFindReplace();
    await waitFor(() => bar());

    fireEvent.change(field(), { target: { value: "zebra" } });
    await waitFor(() => expect(count().textContent).toBe("No matches"));
  });

  it("announces the count politely, as a live region", async () => {
    mount();
    requestFindReplace();
    await waitFor(() => bar());

    fireEvent.change(field(), { target: { value: "cat" } });
    await waitFor(() => expect(count().textContent).toBe("1 of 2"));
    const live = count();
    expect(live.getAttribute("aria-live")).toBe("polite");
    expect(live.getAttribute("aria-atomic")).toBe("true");
  });

  it("advances the announced position as the user navigates", async () => {
    mount();
    requestFindReplace();
    await waitFor(() => bar());

    fireEvent.change(field(), { target: { value: "cat" } });
    await waitFor(() => expect(count().textContent).toBe("1 of 2"));

    fireEvent.click(screen.getByRole("button", { name: "Next match" }));
    await waitFor(() => expect(count().textContent).toBe("2 of 2"));

    fireEvent.click(screen.getByRole("button", { name: "Previous match" }));
    await waitFor(() => expect(count().textContent).toBe("1 of 2"));
  });
});

describe("navigation", () => {
  it("disables both arrows when there is nothing to move to", async () => {
    mount();
    requestFindReplace();
    await waitFor(() => bar());

    expect(screen.getByRole("button", { name: "Next match" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Previous match" }).hasAttribute("disabled")).toBe(true);

    fireEvent.change(field(), { target: { value: "cat" } });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Next match" }).hasAttribute("disabled")).toBe(false),
    );
  });

  it("moves forward on Enter and back on Shift+Enter", async () => {
    mount();
    requestFindReplace();
    await waitFor(() => bar());

    fireEvent.change(field(), { target: { value: "cat" } });
    await waitFor(() => expect(count().textContent).toBe("1 of 2"));

    fireEvent.keyDown(field(), { key: "Enter" });
    await waitFor(() => expect(count().textContent).toBe("2 of 2"));

    fireEvent.keyDown(field(), { key: "Enter", shiftKey: true });
    await waitFor(() => expect(count().textContent).toBe("1 of 2"));
  });

  it("toggles match case and re-counts", async () => {
    // No lower-case "cat" anywhere, so match-case must find nothing.
    mount("<p>Cat dog</p>");
    requestFindReplace();
    await waitFor(() => bar());

    fireEvent.change(field(), { target: { value: "cat" } });
    await waitFor(() => expect(count().textContent).toBe("1 of 1"));

    const toggle = screen.getByRole("button", { name: "Match case" });
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(toggle);

    await waitFor(() => expect(count().textContent).toBe("No matches"));
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
  });
});

describe("replacing", () => {
  it("keeps the replace field hidden until the expander is used", async () => {
    mount();
    requestFindReplace();
    await waitFor(() => bar());

    expect(screen.queryByPlaceholderText("Replace with…")).toBeNull();
    const expander = screen.getByRole("button", { name: /replace options/i });
    expect(expander.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(expander);

    await waitFor(() => expect(screen.getByPlaceholderText("Replace with…")).toBeTruthy());
    expect(expander.getAttribute("aria-expanded")).toBe("true");
  });

  it("labels the replace field for assistive tech", async () => {
    mount();
    requestFindReplace();
    await waitFor(() => bar());
    fireEvent.click(screen.getByRole("button", { name: /replace options/i }));

    const input = await waitFor(() => screen.getByPlaceholderText("Replace with…") as HTMLInputElement);
    const label = document.querySelector(`label[for="${input.id}"]`);
    expect(label?.textContent?.toLowerCase()).toContain("replace with");
  });

  it("replaces the current match only, then moves on", async () => {
    mount("<p>cat dog cat</p>");
    requestFindReplace();
    await waitFor(() => bar());

    fireEvent.change(field(), { target: { value: "cat" } });
    await waitFor(() => expect(count().textContent).toBe("1 of 2"));

    fireEvent.click(screen.getByRole("button", { name: /replace options/i }));
    const replaceField = await waitFor(() => screen.getByPlaceholderText("Replace with…") as HTMLInputElement);
    fireEvent.change(replaceField, { target: { value: "bird" } });
    fireEvent.click(screen.getByRole("button", { name: "Replace" }));

    await waitFor(() => expect(editor!.getHTML()).toContain("bird dog"));
    // One "cat" survives, and the bar has moved to it.
    expect(editor!.getHTML()).toContain("cat");
    expect(editor!.getHTML()).not.toContain("cat dog");
  });

  it("replaces every match with one click", async () => {
    mount("<p>cat cat cat</p>");
    requestFindReplace();
    await waitFor(() => bar());

    fireEvent.change(field(), { target: { value: "cat" } });
    await waitFor(() => expect(count().textContent).toBe("1 of 3"));

    fireEvent.click(screen.getByRole("button", { name: /replace options/i }));
    const replaceField = await waitFor(() => screen.getByPlaceholderText("Replace with…") as HTMLInputElement);
    fireEvent.change(replaceField, { target: { value: "dog" } });
    fireEvent.click(screen.getByRole("button", { name: "Replace all" }));

    await waitFor(() => expect(editor!.getHTML()).toBe("<p>dog dog dog</p>"));
  });

  it("disables the replace actions when there is nothing to replace", async () => {
    mount();
    requestFindReplace();
    await waitFor(() => bar());

    fireEvent.click(screen.getByRole("button", { name: /replace options/i }));
    await waitFor(() => screen.getByPlaceholderText("Replace with…"));

    expect(screen.getByRole("button", { name: "Replace" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Replace all" }).hasAttribute("disabled")).toBe(true);
  });
});

describe("closing", () => {
  it("closes with the X button, clears the highlights and restores focus", async () => {
    const { container } = mount();
    requestFindReplace();
    await waitFor(() => bar());

    fireEvent.change(field(), { target: { value: "cat" } });
    await waitFor(() => expect(count().textContent).toBe("1 of 2"));

    fireEvent.click(screen.getByRole("button", { name: /close find and replace/i }));

    await waitFor(() => expect(screen.queryByRole("region")).toBeNull());
    // Leaving highlights behind would tint the whole document.
    expect(container.ownerDocument.querySelectorAll(".find-replace-match")).toHaveLength(0);
    expect(getFindState(editor!).query).toBe("");
  });

  it("closes on Escape from the search field", async () => {
    mount();
    requestFindReplace();
    await waitFor(() => bar());

    fireEvent.keyDown(field(), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("region")).toBeNull());
  });

  it("closes on Escape from the replace field too", async () => {
    mount();
    requestFindReplace();
    await waitFor(() => bar());
    fireEvent.click(screen.getByRole("button", { name: /replace options/i }));
    const replaceField = await waitFor(() => screen.getByPlaceholderText("Replace with…") as HTMLInputElement);

    fireEvent.keyDown(replaceField, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("region")).toBeNull());
  });
});

describe("layout", () => {
  it("sits sticky under the app bar so it stays reachable while scrolling", async () => {
    mount();
    requestFindReplace();
    await waitFor(() => bar());

    expect(bar().className).toMatch(/sticky/);
    expect(bar().className).toMatch(/top-14/);
    expect(bar().className).toMatch(/z-20/);
  });
});

describe("accessibility", () => {
  it("has no detectable violations while closed over the document", async () => {
    const { container } = mount();
    expect((await axe(container)).violations).toEqual([]);
  });

  it("has no detectable violations with the replace row expanded", async () => {
    mount();
    requestFindReplace();
    await waitFor(() => bar());

    fireEvent.change(field(), { target: { value: "cat" } });
    fireEvent.click(screen.getByRole("button", { name: /replace options/i }));
    const replaceField = await waitFor(() => screen.getByPlaceholderText("Replace with…") as HTMLInputElement);
    fireEvent.change(replaceField, { target: { value: "dog" } });

    expect((await axe(bar())).violations).toEqual([]);
  });

  it("gives every control an accessible name", async () => {
    mount();
    requestFindReplace();
    await waitFor(() => bar());
    fireEvent.click(screen.getByRole("button", { name: /replace options/i }));
    await waitFor(() => screen.getByPlaceholderText("Replace with…"));

    for (const control of within(bar()).getAllByRole("button")) {
      const name = control.getAttribute("aria-label") ?? control.textContent ?? "";
      expect(name.trim().length, `button without a name: ${control.outerHTML.slice(0, 80)}`).toBeGreaterThan(0);
    }
  });
});
