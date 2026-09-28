import { describe, expect, it } from "vitest";
import { normalizeUrl, truncateUrl, urlProblem } from "../url";

describe("normalizeUrl", () => {
  it("assumes https for a bare host, because a relative href would silently not work", () => {
    expect(normalizeUrl("example.com")).toBe("https://example.com");
    expect(normalizeUrl("example.com/docs/page")).toBe(
      "https://example.com/docs/page",
    );
    expect(normalizeUrl("sub.example.co.uk?q=1#frag")).toBe(
      "https://sub.example.co.uk?q=1#frag",
    );
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeUrl("   example.com  ")).toBe("https://example.com");
    expect(normalizeUrl("\thttps://example.com\n")).toBe("https://example.com");
  });

  it("keeps an explicit scheme as typed", () => {
    expect(normalizeUrl("https://example.com")).toBe("https://example.com");
    expect(normalizeUrl("http://example.com")).toBe("http://example.com");
    expect(normalizeUrl("mailto:hi@example.com")).toBe("mailto:hi@example.com");
    expect(normalizeUrl("tel:+15551234567")).toBe("tel:+15551234567");
  });

  it("upgrades a protocol-relative address instead of producing https:////", () => {
    expect(normalizeUrl("//example.com/a")).toBe("https://example.com/a");
  });

  it("refuses script-bearing schemes", () => {
    // The reason this helper exists: writing a raw javascript: href into a
    // document turns exported HTML into script execution.
    expect(normalizeUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeUrl("JavaScript:alert(1)")).toBeNull();
    expect(normalizeUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(normalizeUrl("vbscript:msgbox(1)")).toBeNull();
    expect(normalizeUrl("file:///etc/passwd")).toBeNull();
  });

  it("refuses an empty or whitespace-only address", () => {
    expect(normalizeUrl("")).toBeNull();
    expect(normalizeUrl("    ")).toBeNull();
  });

  it("refuses a scheme with no host or an address with stray spaces", () => {
    expect(normalizeUrl("https://")).toBeNull();
    expect(normalizeUrl("http://")).toBeNull();
    expect(normalizeUrl("https://exa mple.com")).toBeNull();
    expect(normalizeUrl("two words")).toBeNull();
  });

  it("allows a bare host:port for local development", () => {
    expect(normalizeUrl("localhost:3000/docs")).toBe(
      "https://localhost:3000/docs",
    );
  });
});

describe("urlProblem", () => {
  it("says nothing for an empty field, so the form is not scolded before typing", () => {
    expect(urlProblem("")).toBeNull();
    expect(urlProblem("   ")).toBeNull();
  });

  it("says nothing for a valid address", () => {
    expect(urlProblem("example.com")).toBeNull();
    expect(urlProblem("https://example.com")).toBeNull();
  });

  it("explains a rejected scheme distinctly from a malformed address", () => {
    expect(urlProblem("javascript:alert(1)")).toMatch(/isn't allowed/);
    expect(urlProblem("https://")).toMatch(/valid web address/);
  });
});

describe("truncateUrl", () => {
  it("leaves short addresses alone", () => {
    expect(truncateUrl("https://example.com")).toBe("https://example.com");
  });

  it("keeps both ends of a long address so the host stays readable", () => {
    const long =
      "https://example.com/a/very/long/tracking/path?utm_source=newsletter&id=12345";
    const max = 40;
    const out = truncateUrl(long, max);
    expect(out.length).toBeLessThanOrEqual(max);
    expect(out).toContain("…");
    // The host is the part a reader needs to recognise the destination, so the
    // head must be long enough to include it.
    expect(out.startsWith("https://example.com")).toBe(true);
    expect(out.endsWith("12345")).toBe(true);
  });
});
