import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./terrain-prop-pools.ts", import.meta.url), "utf8");

describe("terrain prop wind", () => {
  it("uses bounded GPU motion with position-based phase and a reduced far LOD", () => {
    expect(source).toContain("positionGeometry.y");
    expect(source).toContain("positionLocal.x.mul(0.41)");
    expect(source).toContain("material.positionNode");
    expect(source).toContain('lod === "near" ? 1 : 0.35');
  });
});
