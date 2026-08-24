import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("exploration shroud production wiring", () => {
  it("queues a reveal before authoritative exploration invalidates the terrain page", () => {
    const worldmap = source("src/three/scenes/worldmap.tsx");
    const queue = worldmap.indexOf("this.proceduralTerrain.queueShroudReveal(normalized.x, normalized.y)");
    const apply = worldmap.indexOf("this.applyProjectedExploredTileChange(normalized.x, normalized.y, current)");

    expect(queue).toBeGreaterThan(0);
    expect(queue).toBeLessThan(apply);
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
