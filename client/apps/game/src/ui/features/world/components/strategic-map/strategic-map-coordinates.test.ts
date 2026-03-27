import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

type StrategicMapCoordinatesModule = typeof import("./strategic-map-coordinates");

let coordinates: StrategicMapCoordinatesModule;

describe("strategic-map-coordinates", () => {
  beforeAll(async () => {
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });
    vi.stubGlobal("navigator", {
      getBattery: vi.fn(async () => ({ level: 1, charging: true })),
    });

    coordinates = await import("./strategic-map-coordinates");
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("round-trips contract and centered hex coordinates", () => {
    const original = { col: 505, row: 498 };
    const centered = coordinates.contractHexToCenteredHex(original);
    const restored = coordinates.centeredHexToContractHex(centered);

    expect(restored).toEqual(original);
  });

  it("round-trips pixel coordinates through the nearest offset hex", () => {
    const original = { col: 4, row: -3 };
    const pixel = coordinates.offsetToPixel(original.col, original.row);
    const restored = coordinates.pixelToOffset(pixel.x, pixel.y);

    expect(restored).toEqual(original);
  });

  it("finds the closest tile entry for a pixel position", () => {
    const tiles = [
      { col: 500, row: 500 },
      { col: 501, row: 500 },
    ];
    const index = coordinates.buildCenteredIndex(tiles);
    const centered = coordinates.contractHexToCenteredHex(tiles[1]);
    const pixel = coordinates.offsetToPixel(centered.col, centered.row);
    const entry = coordinates.lookupCenteredEntryForPixel(index, pixel.x, pixel.y);

    expect(entry?.tile).toEqual(tiles[1]);
  });
});
