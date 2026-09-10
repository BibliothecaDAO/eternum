import { describe, expect, it } from "vitest";

import { prepareFastTravelRenderState } from "./fast-travel-rendering";

describe("prepareFastTravelRenderState", () => {
  it("prepares a fully explored no-terrain render state", () => {
    const result = prepareFastTravelRenderState({
      visibleHexWindow: [
        { col: 8, row: 8 },
        { col: 8, row: 9 },
        { col: 9, row: 8 },
      ],
    });

    expect(result.terrainMode).toBe("none");
    expect(result.explorationMode).toBe("fully-explored");
    expect(result.hexes).toEqual([
      { col: 8, row: 8, explored: true },
      { col: 8, row: 9, explored: true },
      { col: 9, row: 8, explored: true },
    ]);
  });

  it("prepares a black-space palette and bounded hex field for the visible hex window", () => {
    const result = prepareFastTravelRenderState({
      visibleHexWindow: [
        { col: 8, row: 8 },
        { col: 12, row: 10 },
      ],
    });

    expect(result.surface.palette).toEqual({
      accentColor: "#ffd6f7",
      backgroundColor: "#000000",
      edgeColor: "#ff4fd8",
      edgeOpacity: 0.92,
      fillColor: "#05000a",
      fillOpacity: 0,
      glowColor: "#ff92ea",
    });
    expect(result.surface.field.bounds).toEqual({
      origin: { col: 8, row: 8 },
      size: { cols: 5, rows: 3 },
    });
  });
});
