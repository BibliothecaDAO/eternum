import { describe, expect, it } from "vitest";

import { resolveExploredHexTransform } from "./worldmap-explored-hex-transform-policy";

describe("resolveExploredHexTransform", () => {
  it("keeps non-flat explored hexes at zero rotation to avoid discovery spin", () => {
    expect(resolveExploredHexTransform({ isFlatMode: false })).toEqual({
      rotationY: 0,
      yOffset: 0.05,
    });
  });

  it("keeps flat explored hexes at zero rotation with flat-mode y offset", () => {
    expect(resolveExploredHexTransform({ isFlatMode: true })).toEqual({
      rotationY: 0,
      yOffset: 0.1,
    });
  });
});
