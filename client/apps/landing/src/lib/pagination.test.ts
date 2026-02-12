import { describe, expect, it } from "vitest";
import { getPaginationWindow } from "./pagination";

describe("getPaginationWindow", () => {
  it("returns a centered window when possible", () => {
    const result = getPaginationWindow({ currentPage: 5, totalPages: 10, maxVisiblePages: 5 });
    expect(result.pages).toEqual([3, 4, 5, 6, 7]);
    expect(result.showFirst).toBe(true);
    expect(result.showLast).toBe(true);
  });

  it("clamps to full range when total pages are smaller than window", () => {
    const result = getPaginationWindow({ currentPage: 2, totalPages: 3, maxVisiblePages: 5 });
    expect(result.pages).toEqual([1, 2, 3]);
    expect(result.showFirst).toBe(false);
    expect(result.showLast).toBe(false);
  });
});
