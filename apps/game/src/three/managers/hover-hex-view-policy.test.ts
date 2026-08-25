import { describe, expect, it } from "vitest";
import { resolveHoverHexViewTuning } from "./hover-hex-view-policy";

describe("hover hex view policy", () => {
  it("thickens the border treatment and center readout as the camera pulls back", () => {
    const close = resolveHoverHexViewTuning(1);
    const far = resolveHoverHexViewTuning(3);

    expect(far.borderThickness).toBeGreaterThan(close.borderThickness);
    expect(far.scanWidth).toBeGreaterThan(close.scanWidth);
    expect(far.centerAlpha).toBeGreaterThan(close.centerAlpha);
  });

  it("keeps the medium camera tuning between close and far", () => {
    const close = resolveHoverHexViewTuning(1);
    const medium = resolveHoverHexViewTuning(2);
    const far = resolveHoverHexViewTuning(3);

    expect(medium.borderThickness).toBeGreaterThan(close.borderThickness);
    expect(medium.borderThickness).toBeLessThan(far.borderThickness);
    expect(medium.centerAlpha).toBeGreaterThan(close.centerAlpha);
    expect(medium.centerAlpha).toBeLessThan(far.centerAlpha);
  });
});
