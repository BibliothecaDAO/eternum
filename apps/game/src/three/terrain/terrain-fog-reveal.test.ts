import { DataTexture } from "three";
import { describe, expect, it } from "vitest";
import { terrainHexToWorld, terrainNeighborCoordinates } from "./terrain-coordinates";
import { resolveFogRevealDirection, TerrainFogReveal } from "./terrain-fog-reveal";

describe("directional exploration reveal", () => {
  it("travels from all six explorer origins, including negative odd rows", () => {
    const target = { col: -8, row: -3 };
    const to = terrainHexToWorld(target.col, target.row);
    for (const origin of terrainNeighborCoordinates(target.col, target.row)) {
      const from = terrainHexToWorld(origin.col, origin.row);
      const direction = resolveFogRevealDirection(target, origin, [0, 0]);
      expect(Math.hypot(...direction)).toBeCloseTo(1);
      expect((from.x - to.x) * direction[0] + (from.z - to.z) * direction[1]).toBeLessThan(0);
    }
    expect(resolveFogRevealDirection(target, undefined, [-1, 0])).toEqual([1, -0]);
  });

  it("ends after 300ms without uploading a texture each animation frame or restarting duplicates", () => {
    const reveal = new TerrainFogReveal();
    reveal.start(-2, 3, [1, 0]);
    const map = (reveal as unknown as { map: DataTexture }).map;
    const version = map.version;
    reveal.update(0.15);
    reveal.start(-2, 3, [0, 1]);
    expect(reveal.size).toBe(1);
    expect(map.version).toBe(version);
    reveal.update(0.15);
    expect(reveal.size).toBe(0);
    expect(map.version).toBe(version);
    reveal.dispose();
  });

  it("keeps neighboring cells inactive and retains simultaneous reveal directions", () => {
    const reveal = new TerrainFogReveal();
    reveal.start(-2, -3, [1, 0]);
    reveal.start(0, -3, [-1, 0]);
    const map = (reveal as unknown as { map: DataTexture }).map;
    expect(map.image.width).toBe(3);
    expect(Array.from(map.image.data!)).toEqual([0, 1, 0, 1, 0, 0, 0, 0, 0, -1, 0, 1]);
    reveal.dispose();
  });

  it("makes reduced-motion discovery immediate and finishes active sweeps", () => {
    const reveal = new TerrainFogReveal();
    reveal.start(0, 0, [1, 0]);
    reveal.setReducedMotion(true);
    expect(reveal.size).toBe(0);
    reveal.start(1, 0, [1, 0]);
    expect(reveal.size).toBe(0);
    reveal.dispose();
  });
});
