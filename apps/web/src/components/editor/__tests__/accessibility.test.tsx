// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { axe } from "vitest-axe";
import * as Y from "yjs";
import { ConnectionStatus } from "../connection-status";
import { VersionHistory } from "../version-history";

// axe needs a real accessibility tree, so these render the components into
// jsdom and run the same axe-core ruleset a browser extension would. This is
// a smoke-level a11y gate — it catches the regressions that matter (missing
// labels, bad roles, colour-only status, non-landmark structure) without
// pretending to be a full manual audit.
//
// vitest-axe 0.1.0's toHaveNoViolations matcher is only exported as a type
// (its extend-expect shim is empty), so instead of registering the matcher we
// assert on the axe results object directly — same guarantee, no broken shim.
afterEach(cleanup);

function expectNoViolations(results: Awaited<ReturnType<typeof axe>>) {
  expect(results.violations).toEqual([]);
}

describe("accessibility (axe-core)", () => {
  it("ConnectionStatus has no violations in every state", async () => {
    for (const status of ["online", "offline", "syncing", "conflict-resolved"] as const) {
      const { container, unmount } = render(<ConnectionStatus status={status} />);
      expectNoViolations(await axe(container));
      unmount();
    }
  });

  it("ConnectionStatus exposes its text through a live region, not colour alone", () => {
    const { getByRole } = render(<ConnectionStatus status="offline" />);
    // role=status is an implicit aria-live region; the meaningful text must be
    // present in it so a non-sighted user isn't relying on the dot's colour
    const region = getByRole("status");
    expect(region.getAttribute("aria-live")).toBeTruthy();
    expect(region.textContent).toMatch(/offline/i);
  });

  it("VersionHistory trigger has no violations and advertises the panel it controls", async () => {
    // Rendered closed (its default) so no versions fetch fires — this covers
    // the trigger's a11y wiring (aria-expanded / aria-controls) without
    // needing to stub the network.
    const doc = new Y.Doc();
    const { container, getByRole } = render(
      <VersionHistory documentId="doc-1" doc={doc} canWrite />,
    );
    expectNoViolations(await axe(container));
    const trigger = getByRole("button", { name: /history/i });
    expect(trigger.getAttribute("aria-controls")).toBe("version-history-panel");
    doc.destroy();
  });
});
