// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("HexagonScene unexplored ground shadows", () => {
  it("does not receive structure shadows on the fog ground plane", () => {
    const source = readFileSync(resolve(process.cwd(), "src/three/scenes/hexagon-scene.ts"), "utf8");
    const methodStart = source.indexOf("private createGroundMesh()");
    const methodEnd = source.indexOf("protected shouldUpdateBiomeAnimations", methodStart);
    const body = source.slice(methodStart, methodEnd);

    expect(body).toContain("mesh.receiveShadow = false");
    expect(body).not.toContain("mesh.receiveShadow = true");
  });
});
