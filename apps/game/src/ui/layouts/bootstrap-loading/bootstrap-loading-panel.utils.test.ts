import { describe, expect, it } from "vitest";

import { getDisplayProgress, getNextStatementIndex } from "./bootstrap-loading-panel.utils";

describe("bootstrap-loading-panel utils", () => {
  it("caps completed progress at 99 to avoid flashing 100 before ready", () => {
    expect(getDisplayProgress(100)).toBe(99);
    expect(getDisplayProgress(134)).toBe(99);
  });

  it("preserves in-flight progress values", () => {
    expect(getDisplayProgress(0)).toBe(0);
    expect(getDisplayProgress(42)).toBe(42);
    expect(getDisplayProgress(99)).toBe(99);
  });

  it("cycles loading statements safely", () => {
    expect(getNextStatementIndex(0, 4)).toBe(1);
    expect(getNextStatementIndex(3, 4)).toBe(0);
    expect(getNextStatementIndex(2, 0)).toBe(0);
  });
});
