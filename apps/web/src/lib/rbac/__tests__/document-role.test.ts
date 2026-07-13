import { describe, it, expect } from "vitest";
import { assertAllowedRole, ForbiddenError } from "../document-role.js";

describe("assertAllowedRole", () => {
  it("returns the role when it's in the allowed set", () => {
    expect(assertAllowedRole("owner", ["owner", "editor"])).toBe("owner");
  });

  it("throws ForbiddenError when the role isn't in the allowed set", () => {
    expect(() => assertAllowedRole("viewer", ["owner", "editor"])).toThrow(ForbiddenError);
  });

  it("throws ForbiddenError when there's no role at all (not a member)", () => {
    expect(() => assertAllowedRole(undefined, ["owner", "editor", "viewer"])).toThrow(
      ForbiddenError,
    );
  });
});
