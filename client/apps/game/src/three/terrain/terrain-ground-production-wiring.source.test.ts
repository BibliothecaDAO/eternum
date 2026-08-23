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

  it("retains the flat material as the far-camera terrain LOD", () => {
    const worldmap = source("src/three/scenes/worldmap.tsx");

    expect(worldmap).toContain("setGroundTextureDetailEnabled(view !== CameraView.Far)");
  });

  it("reserves near prop geometry for the close camera view", () => {
    const worldmap = source("src/three/scenes/worldmap.tsx");

    expect(worldmap).toContain('setPropLod(view === CameraView.Close ? "near" : "far")');
  });
});
