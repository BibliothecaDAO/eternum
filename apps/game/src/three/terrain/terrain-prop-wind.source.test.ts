import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./terrain-prop-pools.ts", import.meta.url), "utf8");

describe("terrain prop wind", () => {
  it("limits biome-scaled GPU motion to imported foliage and shades the same instances for climate", () => {
    expect(source).toContain("positionGeometry.y");
    expect(source).toContain('attribute<"float">("_wind_weight", "float")');
    expect(source).toContain('attribute<"vec3">("terrainPropEcology", "vec3")');
    expect(source).toContain("positionLocal.x.mul(0.41)");
    expect(source).toContain("instance.appearance.windAmplitude");
    expect(source).toContain("material.colorNode");
    expect(source).toContain("material.positionNode");
    expect(source).toContain('lod === "near" ? 1 : 0.35');
  });
});
