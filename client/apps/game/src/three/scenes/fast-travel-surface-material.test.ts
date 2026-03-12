import { describe, expect, it } from "vitest";

import { createFastTravelSurfacePalette } from "./fast-travel-surface-material";

describe("createFastTravelSurfacePalette", () => {
  it("styles fast travel as black space with pink-edged hexes", () => {
    expect(createFastTravelSurfacePalette()).toEqual({
      accentColor: "#ffd6f7",
      backgroundColor: "#000000",
      edgeColor: "#ff4fd8",
      edgeOpacity: 0.92,
      fillColor: "#05000a",
      fillOpacity: 0,
      glowColor: "#ff92ea",
    });
  });
});
