import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  isHexWithinTerrainPresentationBounds,
  resolveTerrainPresentationBounds,
} from "./worldmap-terrain-bounds-policy";

function readWorldmapSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const worldmapPath = resolve(currentDir, "worldmap.tsx");
  return readFileSync(worldmapPath, "utf8");
}

describe("resolveTerrainPresentationBounds", () => {
  const baseInput = {
    startRow: 0,
    startCol: 0,
    renderSize: { width: 10, height: 10 },
    chunkSize: 10,
  };

  it("padded bounds include edge hex extents", () => {
    const bounds = resolveTerrainPresentationBounds(baseInput);

    // getRenderBounds with startRow=0, startCol=0, width=10, height=10, chunkSize=10:
    //   chunkCenter = (5, 5), minCol = 5 - 5 = 0, maxCol = 0 + 10 - 1 = 9
    //   minRow = 5 - 5 = 0, maxRow = 0 + 10 - 1 = 9
    // With default hexPadding=2, totalExpansion = 1 + 2 = 3
    // So padded: minCol = 0 - 3 = -3, maxCol = 9 + 3 = 12
    expect(bounds.minCol).toBe(-3);
    expect(bounds.maxCol).toBe(12);
    expect(bounds.minRow).toBe(-3);
    expect(bounds.maxRow).toBe(12);

    // An edge hex at col=0 in the raw bounds is now well inside the padded bounds.
    // A hex at col=-1 (just outside raw bounds but within hex footprint) is included.
    expect(isHexWithinTerrainPresentationBounds(-1, 0, bounds)).toBe(true);
    expect(isHexWithinTerrainPresentationBounds(10, 0, bounds)).toBe(true);
  });

  it("padded bounds include required terrain height margin", () => {
    const bounds = resolveTerrainPresentationBounds(baseInput);

    expect(bounds.minY).toBe(-1);
    expect(bounds.maxY).toBe(10);
  });

  it("prepared terrain bounds remain conservative for ocean-heavy windows", () => {
    // Ocean-heavy windows may have fewer hexes but the bounds should still be
    // padded conservatively based on geometry, not content.
    const oceanInput = {
      startRow: 100,
      startCol: 100,
      renderSize: { width: 48, height: 48 },
      chunkSize: 48,
    };
    const bounds = resolveTerrainPresentationBounds(oceanInput);

    // chunkCenter = (124, 124), minCol = 124 - 24 = 100, maxCol = 100 + 48 - 1 = 147
    // totalExpansion = 3
    expect(bounds.minCol).toBe(100 - 3);
    expect(bounds.maxCol).toBe(147 + 3);
    expect(bounds.minRow).toBe(100 - 3);
    expect(bounds.maxRow).toBe(147 + 3);
  });

  it("isHexWithinTerrainPresentationBounds returns true for edge hexes inside padding", () => {
    const bounds = resolveTerrainPresentationBounds(baseInput);

    // Exact boundary hexes should be included
    expect(isHexWithinTerrainPresentationBounds(bounds.minCol, bounds.minRow, bounds)).toBe(true);
    expect(isHexWithinTerrainPresentationBounds(bounds.maxCol, bounds.maxRow, bounds)).toBe(true);
    expect(isHexWithinTerrainPresentationBounds(bounds.minCol, bounds.maxRow, bounds)).toBe(true);
    expect(isHexWithinTerrainPresentationBounds(bounds.maxCol, bounds.minRow, bounds)).toBe(true);
  });

  it("isHexWithinTerrainPresentationBounds returns false for hexes outside padding", () => {
    const bounds = resolveTerrainPresentationBounds(baseInput);

    expect(isHexWithinTerrainPresentationBounds(bounds.minCol - 1, 0, bounds)).toBe(false);
    expect(isHexWithinTerrainPresentationBounds(bounds.maxCol + 1, 0, bounds)).toBe(false);
    expect(isHexWithinTerrainPresentationBounds(0, bounds.minRow - 1, bounds)).toBe(false);
    expect(isHexWithinTerrainPresentationBounds(0, bounds.maxRow + 1, bounds)).toBe(false);
  });

  it("custom hexPadding and heightRange are respected", () => {
    const bounds = resolveTerrainPresentationBounds({
      ...baseInput,
      hexPadding: 5,
      heightRange: [-10, 50],
    });

    // totalExpansion = 1 + 5 = 6
    // raw minCol = 0, raw maxCol = 9
    expect(bounds.minCol).toBe(0 - 6);
    expect(bounds.maxCol).toBe(9 + 6);
    expect(bounds.minRow).toBe(0 - 6);
    expect(bounds.maxRow).toBe(9 + 6);
    expect(bounds.minY).toBe(-10);
    expect(bounds.maxY).toBe(50);
  });

  it("worldmap runtime chunk bounds are sourced from the terrain presentation bounds policy", () => {
    const source = readWorldmapSource();

    expect(source).toMatch(/resolveTerrainPresentationWorldBounds/);
  });
});
