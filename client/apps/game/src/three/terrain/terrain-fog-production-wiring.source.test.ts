import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("continuous exploration fog production wiring", () => {
  it("renders one texture-backed mist sheet without per-cell shroud meshes", () => {
    const fogField = source("src/three/terrain/terrain-fog-field.ts");

    expect(fogField).toContain("new PlaneGeometry(1, 1, 1, 1)");
    expect(fogField).toContain("buildTerrainFogMask(ordered)");
    expect(fogField).not.toContain("InstancedMesh");
    expect(fogField).not.toContain("terrain-exploration-shroud-frontier");
  });

  it("keeps mask animation in the fog field while terrain authority remains external", () => {
    const fogField = source("src/three/terrain/terrain-fog-field.ts");
    const terrain = source("src/three/terrain/procedural-terrain.ts");

    expect(fogField).toContain("applyTerrainFogReveals(this.mask, reveals, this.textureData)");
    expect(terrain).toContain("this.fogField.queueReveal(col, row)");
    expect(terrain).toContain("this.fogField.updateAnimation(deltaSeconds)");
  });

  it("reports the worst reveal commit instead of summing separate presentation frames", () => {
    const debugRenderer = source("src/three/debug/procedural-terrain-debug-renderer.ts");

    expect(debugRenderer).toContain("commitMs = Math.max(commitMs, performance.now() - commitStartedAt)");
    expect(debugRenderer).not.toContain("commitMs += performance.now() - commitStartedAt");
  });

  it("prepares the global distance mask on the terrain worker before the atomic worldmap commit", () => {
    const worldmapTerrain = source("src/three/terrain/worldmap-procedural-terrain.ts");
    const prepareMask = worldmapTerrain.indexOf("await this.terrain.prepareFogMaskAsync(preparedPages)");
    const commit = worldmapTerrain.indexOf(
      "this.commitPreparedPages(input, preparedPages, nextCache, builtPages, reusedPages, fogMask)",
    );

    expect(prepareMask).toBeGreaterThan(0);
    expect(prepareMask).toBeLessThan(commit);
  });
});
