// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("procedural ground texture production wiring", () => {
  it("loads textured ground in both playable terrain scenes with an explicit flat fallback", () => {
    const worldmap = source("src/three/scenes/worldmap.tsx");
    const hexception = source("src/three/scenes/hexception.tsx");

    expect(worldmap).toContain("this.proceduralTerrain.loadGroundTextures()");
    expect(worldmap).toContain("retaining flat terrain");
    expect(hexception).toContain("this.proceduralTerrain.loadGroundTextures()");
    expect(hexception).toContain("retaining flat terrain");
  });

  it("lets procedural terrain exclusively own Hexception's visible ground", () => {
    const hexception = source("src/three/scenes/hexception.tsx");

    expect(hexception).toContain("this.presentProceduralTerrain(terrainMatricesByBiome)");
    expect(hexception).toContain("this.interactiveHexManager.setSurfaceVisibility(false)");
    expect(hexception).not.toContain("this.pillars");
    expect(hexception).not.toContain("BIOME_COLORS");
  });

  it("keeps the worldmap on the full-detail terrain profile at every zoom", () => {
    const worldmap = source("src/three/scenes/worldmap.tsx");
    const terrain = source("src/three/terrain/procedural-terrain.ts");

    expect(worldmap).not.toContain("setQualityTier(");
    expect(worldmap).not.toContain('setPropLod(view === CameraView.Close ? "near" : "far")');
    expect(terrain).toContain("this.setQualityTier(this.qualityTier);");
  });

  it("benchmarks the normal-play balanced terrain tier", () => {
    const benchmark = source("src/three/debug/procedural-terrain-benchmark-renderer.ts");

    expect(benchmark).toContain('runtime.terrain.setQualityTier("balanced")');
  });
});
