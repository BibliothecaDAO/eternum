import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./terrain-material.ts", import.meta.url), "utf8");

describe("terrain material fidelity", () => {
  it("uses four shared ground-array samples without a separate lava texture", () => {
    expect(source).not.toContain("mx_noise_float");
    expect(source.match(/texture\(textures\./g)).toHaveLength(4);
    expect(source.match(/texture\(/g)).toHaveLength(4);
  });

  it("keeps lava animation independent of wind quality while honoring reduced motion", () => {
    expect(source).toContain("time.mul(4).mul(step(0.001, motion))");
    expect(source).not.toContain("resolveTerrainLavaClearance");
  });

  it("drives one water material from continuous bathymetry without adding texture samples", () => {
    expect(source).toContain('attribute<"float">("terrainWaterDepth"');
    expect(source).toContain("TERRAIN_SHALLOW_WATER_DEPTH");
    expect(source).toContain("TERRAIN_DEEP_WATER_DEPTH");
    expect(source.match(/texture\(textures\./g)).toHaveLength(4);
  });

  it("derives wave normals, Fresnel sheen, and shoreline foam inside the shared water material", () => {
    expect(source).toContain("createTerrainWaterWaves");
    expect(source).toContain("material.normalNode = waveNormalView");
    expect(source).toContain("waveNormalView.dot(positionViewDirection)");
    expect(source).toContain("transformNormalToView(waves.normal)");
    expect(source).toContain("createTerrainWaterFoam");
  });
});
