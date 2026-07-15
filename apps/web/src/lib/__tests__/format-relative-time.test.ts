import { describe, expect, it } from "vitest";
import { formatRelativeTime } from "../format-relative-time";

const NOW = new Date("2026-07-15T12:00:00Z");

function at(offsetSeconds: number): Date {
  return new Date(NOW.getTime() - offsetSeconds * 1000);
}

describe("formatRelativeTime", () => {
  it("says 'just now' under 45 seconds", () => {
    expect(formatRelativeTime(at(0), NOW)).toBe("just now");
    expect(formatRelativeTime(at(44), NOW)).toBe("just now");
  });

  it("uses minutes under an hour", () => {
    expect(formatRelativeTime(at(60), NOW)).toBe("1 min ago");
    expect(formatRelativeTime(at(35 * 60), NOW)).toBe("35 min ago");
  });

  it("uses hours under a day, with singular form", () => {
    expect(formatRelativeTime(at(60 * 60), NOW)).toBe("1 hour ago");
    expect(formatRelativeTime(at(5 * 60 * 60), NOW)).toBe("5 hours ago");
  });

  it("uses days under a week, with 'yesterday'", () => {
    expect(formatRelativeTime(at(24 * 60 * 60), NOW)).toBe("yesterday");
    expect(formatRelativeTime(at(3 * 24 * 60 * 60), NOW)).toBe("3 days ago");
  });

  it("falls back to an absolute date at a week or more", () => {
    // exact string is locale-dependent; assert it contains the year instead
    expect(formatRelativeTime(at(8 * 24 * 60 * 60), NOW)).toContain("2026");
  });
});
