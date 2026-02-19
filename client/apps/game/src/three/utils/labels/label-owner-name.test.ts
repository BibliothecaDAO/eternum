import { describe, expect, it } from "vitest";
import { resolveOwnerDisplayName } from "./owner-display-name";

describe("resolveOwnerDisplayName", () => {
  it("falls back to The Vanguard for unowned labels with empty names", () => {
    expect(resolveOwnerDisplayName("", 0n, "The Vanguard")).toBe("The Vanguard");
  });

  it("prefers explicit owner names", () => {
    expect(resolveOwnerDisplayName("Alice", 0n, "The Vanguard")).toBe("Alice");
  });

  it("keeps empty names for non-zero owners", () => {
    expect(resolveOwnerDisplayName("", 123n, "The Vanguard")).toBe("");
  });
});
