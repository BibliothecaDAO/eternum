import { describe, expect, it } from "vitest";
import { resolveWorldmapChunkCoordinates } from "./worldmap-chunk-coordinates";

function getWorldPositionForHex(hex: { col: number; row: number }): { x: number; z: number } {
  const hexSize = 1;
  const hexWidth = Math.sqrt(3) * hexSize;
  const vertDist = hexSize * 2 * 0.75;
  const rowOffset = ((hex.row % 2) * Math.sign(hex.row) * hexWidth) / 2;
  return {
    x: hex.col * hexWidth - rowOffset,
    z: hex.row * vertDist,
  };
}

describe("resolveWorldmapChunkCoordinates", () => {
  it("keeps chunk assignment aligned with hex coordinates for odd-row world positions", () => {
    const chunkSize = 24;
    const testHexes = [
      { col: 24, row: 81 },
      { col: 48, row: 81 },
      { col: -24, row: 81 },
      { col: 24, row: -81 },
      { col: -24, row: -81 },
    ];

    testHexes.forEach((hex) => {
      const worldPosition = getWorldPositionForHex(hex);
      const { chunkX, chunkZ } = resolveWorldmapChunkCoordinates({
        x: worldPosition.x,
        z: worldPosition.z,
        chunkSize,
        hexSize: 1,
      });

      expect(chunkX * chunkSize).toBe(Math.floor(hex.col / chunkSize) * chunkSize);
      expect(chunkZ * chunkSize).toBe(Math.floor(hex.row / chunkSize) * chunkSize);
    });
  });
});
