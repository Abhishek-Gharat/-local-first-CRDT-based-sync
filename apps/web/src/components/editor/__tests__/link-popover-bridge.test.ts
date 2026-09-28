import { afterEach, describe, expect, it, vi } from "vitest";
import {
  onLinkPopoverRequest,
  requestLinkPopover,
  resetLinkPopoverBridge,
} from "../link-popover-bridge";

afterEach(() => {
  resetLinkPopoverBridge();
});

describe("link popover bridge", () => {
  it("notifies subscribers", () => {
    const listener = vi.fn();
    onLinkPopoverRequest(listener);
    requestLinkPopover();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("notifies every subscriber", () => {
    const first = vi.fn();
    const second = vi.fn();
    onLinkPopoverRequest(first);
    onLinkPopoverRequest(second);
    requestLinkPopover();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("stops notifying after unsubscribe, so an unmounted toolbar cannot leak", () => {
    const listener = vi.fn();
    const off = onLinkPopoverRequest(listener);
    off();
    requestLinkPopover();
    expect(listener).not.toHaveBeenCalled();
  });

  it("is inert with nothing mounted, as it must be for a viewer", () => {
    // A read-only editor renders no toolbar, so ⌘K has no popover to open.
    expect(() => requestLinkPopover()).not.toThrow();
  });

  it("survives a subscriber unsubscribing during notification", () => {
    // Iterating a copy of the set means a listener that tears itself down
    // mid-notify cannot corrupt the loop.
    const calls: string[] = [];
    const offFirst = onLinkPopoverRequest(() => {
      calls.push("first");
      offFirst();
    });
    onLinkPopoverRequest(() => calls.push("second"));
    requestLinkPopover();
    expect(calls).toEqual(["first", "second"]);
  });
});
