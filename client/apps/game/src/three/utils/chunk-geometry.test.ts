import { describe, expect, it, vi } from "vitest";

vi.mock("./utils", () => ({
  getWorldPositionForHex: ({ col, row }: { col: number; row: number }) => ({ x: col, y: 0, z: row }),
}));
import { getRenderBounds, isHexWithinRenderBounds } from "./chunk-geometry";

describe("getRenderBounds", () => {
  it("returns even-sized bounds with exact cell coverage", () => {
    const bounds = getRenderBounds(0, 0, { width: 48, height: 48 }, 24);
    expect(bounds).toEqual({
      minCol: -12,
      maxCol: 35,
      minRow: -12,
      maxRow: 35,
    });
  });

  it("returns odd-sized bounds with exact cell coverage", () => {
    const bounds = getRenderBounds(0, 0, { width: 49, height: 49 }, 24);
    expect(bounds).toEqual({
      minCol: -12,
      maxCol: 36,
      minRow: -12,
      maxRow: 36,
    });
  });
});

describe("isHexWithinRenderBounds", () => {
  it("keeps max edge inclusive under half-window bounds", () => {
    expect(isHexWithinRenderBounds(35, 35, 0, 0, { width: 48, height: 48 }, 24)).toBe(true);
    expect(isHexWithinRenderBounds(36, 35, 0, 0, { width: 48, height: 48 }, 24)).toBe(false);
    expect(isHexWithinRenderBounds(37, 35, 0, 0, { width: 48, height: 48 }, 24)).toBe(false);
    expect(isHexWithinRenderBounds(35, 37, 0, 0, { width: 48, height: 48 }, 24)).toBe(false);
  });
});
