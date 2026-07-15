// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { axe } from "vitest-axe";
import { SharePanel } from "../share-panel";

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

const MEMBERS = [
  { id: "m1", userId: "u1", role: "owner", email: "owner@test.com", name: "Owner" },
];

describe("SharePanel", () => {
  it("closed trigger passes axe and advertises the panel it controls", async () => {
    const { container, getByRole } = render(<SharePanel documentId="doc-1" />);
    expect((await axe(container)).violations).toEqual([]);
    const trigger = getByRole("button", { name: /share/i });
    expect(trigger.getAttribute("aria-controls")).toBe("share-panel");
  });

  it("opens, lists current members, and posts a new member by email", async () => {
    const fetchMock = stubFetch((url, init) => {
      if (init?.method === "POST") {
        expect(JSON.parse(String(init.body))).toEqual({
          email: "friend@test.com",
          role: "viewer",
        });
        return Response.json({ member: { id: "m2" } }, { status: 201 });
      }
      expect(url).toBe("/api/documents/doc-1/members");
      return Response.json({ members: MEMBERS });
    });

    const { getByRole, getByLabelText, getByText, container } = render(
      <SharePanel documentId="doc-1" />,
    );
    fireEvent.click(getByRole("button", { name: /share/i }));

    await waitFor(() => expect(getByText(/owner@test.com/)).toBeTruthy());

    fireEvent.change(getByLabelText(/email/i), {
      target: { value: "friend@test.com" },
    });
    fireEvent.change(getByLabelText(/role/i), { target: { value: "viewer" } });
    fireEvent.click(getByRole("button", { name: /^add$/i }));

    await waitFor(() =>
      expect(getByRole("status").textContent).toMatch(/added friend@test\.com as viewer/i),
    );
    // the POST plus the initial and post-add member reloads
    expect(fetchMock.mock.calls.length).toBe(3);
    // the open panel also passes axe
    expect((await axe(container)).violations).toEqual([]);
  });

  it("surfaces a useful message when the invitee has no account", async () => {
    stubFetch((_url, init) =>
      init?.method === "POST"
        ? Response.json({ error: "no user with that email" }, { status: 404 })
        : Response.json({ members: MEMBERS }),
    );

    const { getByRole, getByLabelText } = render(<SharePanel documentId="doc-1" />);
    fireEvent.click(getByRole("button", { name: /share/i }));
    fireEvent.change(getByLabelText(/email/i), {
      target: { value: "ghost@test.com" },
    });
    fireEvent.click(getByRole("button", { name: /^add$/i }));

    await waitFor(() =>
      expect(getByRole("status").textContent).toMatch(/no account exists/i),
    );
  });
});
