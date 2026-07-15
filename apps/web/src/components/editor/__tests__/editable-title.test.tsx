// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { EditableTitle } from "../editable-title";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("EditableTitle", () => {
  it("renders a static heading for viewers (no rename affordance)", () => {
    const { getByRole, queryByRole } = render(
      <EditableTitle documentId="d1" initialTitle="My doc" canRename={false} />,
    );
    expect(getByRole("heading", { level: 1 }).textContent).toBe("My doc");
    expect(queryByRole("button")).toBeNull();
  });

  it("commits a rename via PATCH on Enter and keeps the new title", async () => {
    const fetchMock = vi.fn(async (...args: [RequestInfo | URL, RequestInit?]) => {
      void args;
      return Response.json({ document: { id: "d1", title: "Renamed" } });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getByRole, getByLabelText } = render(
      <EditableTitle documentId="d1" initialTitle="My doc" canRename />,
    );
    fireEvent.click(getByRole("button", { name: /my doc/i }));
    const input = getByLabelText("Document title");
    fireEvent.change(input, { target: { value: "Renamed" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/documents/d1",
        expect.objectContaining({ method: "PATCH" }),
      );
      expect(getByRole("heading", { level: 1 }).textContent).toBe("Renamed");
    });
    const init = fetchMock.mock.calls[0]?.[1];
    expect(JSON.parse(String(init?.body))).toEqual({ title: "Renamed" });
  });

  it("rolls back to the previous title when the PATCH fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ error: "forbidden" }, { status: 403 })),
    );

    const { getByRole, getByLabelText } = render(
      <EditableTitle documentId="d1" initialTitle="My doc" canRename />,
    );
    fireEvent.click(getByRole("button", { name: /my doc/i }));
    const input = getByLabelText("Document title");
    fireEvent.change(input, { target: { value: "Nope" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() =>
      expect(getByRole("heading", { level: 1 }).textContent).toBe("My doc"),
    );
  });

  it("cancels on Escape without any network call", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { getByRole, getByLabelText } = render(
      <EditableTitle documentId="d1" initialTitle="My doc" canRename />,
    );
    fireEvent.click(getByRole("button", { name: /my doc/i }));
    const input = getByLabelText("Document title");
    fireEvent.change(input, { target: { value: "Discarded" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(getByRole("heading", { level: 1 }).textContent).toBe("My doc");
  });
});
