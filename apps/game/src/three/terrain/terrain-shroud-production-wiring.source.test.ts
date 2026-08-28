import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("exploration shroud production wiring", () => {
  it("queues a reveal at the shared projection writer used by live and hydrated tiles", () => {
    const worldmap = source("src/three/scenes/worldmap.tsx");
    const writerStart = worldmap.indexOf("private writeExploredTileFromProjection");
    const writerEnd = worldmap.indexOf("private touchMatrixCache", writerStart);
    const writer = worldmap.slice(writerStart, writerEnd);

    expect(writer).toContain("this.proceduralTerrain.queueShroudReveal(col, row)");
    expect(writer).toContain("this.invalidateVisualTerrainPageForLiveTile(col, row)");
    expect(worldmap.match(/writeExploredTileFromProjection\(/g)).toHaveLength(3);
  });

  it("finishes a reveal within the 300 ms interaction budget", () => {
    const fogField = source("src/three/terrain/terrain-fog-field.ts");

    expect(fogField).toContain("TERRAIN_FOG_REVEAL_DURATION_SECONDS = 0.25");
  });

  it("advances reveal presentation from the normal worldmap frame loop", () => {
    const worldmap = source("src/three/scenes/worldmap.tsx");

    expect(worldmap).toContain("this.proceduralTerrain.update(deltaTime)");
  });

  it("keeps exploration explicit at the worldmap-to-terrain adapter boundary", () => {
    const adapter = source("src/three/terrain/worldmap-procedural-terrain.ts");

    expect(adapter).toContain("explored: biome !== null");
  });

  it("defers hidden biome classification to frontier work in the terrain worker", () => {
    const adapter = source("src/three/terrain/worldmap-procedural-terrain.ts");

    expect(adapter).toContain("previewBiome: biome");
    expect(adapter).not.toContain("Biome.getBiome");
  });
});
