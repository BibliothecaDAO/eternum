import { describe, expect, it } from "vitest";
import { buildSidebarCookie, resolveNextSidebarOpen } from "./sidebar-utils";

describe("sidebar-utils", () => {
  it("resolves next value from updater function", () => {
    expect(resolveNextSidebarOpen(false, (prev) => !prev)).toBe(true);
  });

  it("builds cookie string from next open value", () => {
    const cookie = buildSidebarCookie(true);
    expect(cookie).toContain("sidebar:state=true");
  });
});
