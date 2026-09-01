import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./terrain-material.ts", import.meta.url), "utf8");

describe("terrain material fidelity", () => {
  it("keeps one shared four-sample material after CPU-authored macro and shoreline treatment", () => {
    expect(source).not.toContain("mx_noise_float");
    expect(source.match(/texture\(textures\./g)).toHaveLength(4);
  });

  it("drives one water material from continuous bathymetry without adding texture samples", () => {
    expect(source).toContain('attribute<"float">("terrainWaterDepth"');
    expect(source).toContain("TERRAIN_SHALLOW_WATER_DEPTH");
    expect(source).toContain("TERRAIN_DEEP_WATER_DEPTH");
    expect(source.match(/texture\(textures\./g)).toHaveLength(4);
  });

  it("derives wave normals, Fresnel sheen, and shoreline foam inside the shared water material", () => {
    expect(source).toContain("createTerrainWaterWaves");
    expect(source).toContain("material.normalNode = normalMap");
    expect(source).toContain("normalView.dot(positionViewDirection)");
    expect(source).toContain("createTerrainWaterFoam");
  });
});
