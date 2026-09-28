// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { axe } from "vitest-axe";
import { DeleteDocumentDialog } from "../delete-document-dialog";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function stubFetch(handler: (url: string, init?: RequestInit) => Response) {
  const mock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
    handler(String(input), init),
  );
  vi.stubGlobal("fetch", mock);
  return mock;
}

const TARGET = { id: "doc-1", title: "Q3 roadmap" };

function renderDialog(overrides: Partial<React.ComponentProps<typeof DeleteDocumentDialog>> = {}) {
  const onDeleted = vi.fn();
  const onOpenChange = vi.fn();
  const utils = render(
    <DeleteDocumentDialog
      target={TARGET}
      onOpenChange={onOpenChange}
      onDeleted={onDeleted}
      {...overrides}
    />,
  );
  return { ...utils, onDeleted, onOpenChange };
}

describe("DeleteDocumentDialog", () => {
  it("is exposed as an alertdialog with an accessible name and description", async () => {
    stubFetch(() => new Response(null, { status: 204 }));
    const { container, getByRole } = renderDialog();

    const dialog = await waitFor(() => getByRole("alertdialog"));
    expect(dialog).toBeTruthy();

    // Base UI wires the title/description parts into the popup.
    const labelledBy = dialog.getAttribute("aria-labelledby");
    const describedBy = dialog.getAttribute("aria-describedby");
    expect(labelledBy).toBeTruthy();
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(labelledBy!)?.textContent).toBe(
      "Delete document",
    );
    expect(document.getElementById(describedBy!)?.textContent).toContain(
      "Q3 roadmap",
    );

    expect((await axe(container)).violations).toEqual([]);
  });

  it("sends DELETE to the document endpoint and reports success", async () => {
    const fetchMock = stubFetch(() => new Response(null, { status: 204 }));
    const { getByRole, onDeleted, onOpenChange } = renderDialog();

    fireEvent.click(await waitFor(() => getByRole("button", { name: /^delete$/i })));

    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith(TARGET));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/documents/doc-1",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("surfaces a specific message when the server refuses (403)", async () => {
    stubFetch(() => Response.json({ error: "forbidden" }, { status: 403 }));
    const { getByRole, onDeleted } = renderDialog();

    fireEvent.click(await waitFor(() => getByRole("button", { name: /^delete$/i })));

    await waitFor(() =>
      expect(getByRole("alert").textContent).toMatch(/only the document owner/i),
    );
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it("treats a 404 as already-deleted rather than a generic failure", async () => {
    stubFetch(() => Response.json({ error: "not found" }, { status: 404 }));
    const { getByRole } = renderDialog();

    fireEvent.click(await waitFor(() => getByRole("button", { name: /^delete$/i })));

    await waitFor(() =>
      expect(getByRole("alert").textContent).toMatch(/no longer exists/i),
    );
  });

  it("reports a network failure instead of throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    const { getByRole, onDeleted } = renderDialog();

    fireEvent.click(await waitFor(() => getByRole("button", { name: /^delete$/i })));

    await waitFor(() =>
      expect(getByRole("alert").textContent).toMatch(/could not reach the server/i),
    );
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it("cancels without issuing a request", async () => {
    const fetchMock = stubFetch(() => new Response(null, { status: 204 }));
    const { getByRole, onOpenChange, onDeleted } = renderDialog();

    fireEvent.click(await waitFor(() => getByRole("button", { name: /cancel/i })));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it("renders nothing destructive when there is no target", () => {
    stubFetch(() => new Response(null, { status: 204 }));
    const { queryByRole } = renderDialog({ target: null });
    expect(queryByRole("alertdialog")).toBeNull();
  });
});
