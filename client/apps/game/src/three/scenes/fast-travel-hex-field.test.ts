import { describe, expect, it } from "vitest";

import { buildFastTravelHexField } from "./fast-travel-hex-field";

describe("buildFastTravelHexField", () => {
  it("derives fully explored visible hex tiles with stable bounds", () => {
    const result = buildFastTravelHexField({
      visibleHexWindow: [
        { col: 8, row: 8 },
        { col: 9, row: 8 },
        { col: 8, row: 9 },
      ],
    });

    expect(result.bounds).toEqual({
      origin: { col: 8, row: 8 },
      size: { cols: 2, rows: 2 },
    });
    expect(result.tiles).toEqual([
      {
        explored: true,
        hexCoords: { col: 8, row: 8 },
        worldPosition: { x: 13.856406460551018, y: 0, z: 12 },
      },
      {
        explored: true,
        hexCoords: { col: 9, row: 8 },
        worldPosition: { x: 15.588457268119894, y: 0, z: 12 },
      },
      {
        explored: true,
        hexCoords: { col: 8, row: 9 },
        worldPosition: { x: 12.990381056766578, y: 0, z: 13.5 },
      },
    ]);
  });
});
