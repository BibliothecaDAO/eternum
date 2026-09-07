import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("continuous exploration fog production wiring", () => {
  it("shares the fog with terrain materials without per-cell shroud meshes", () => {
    const fogField = source("src/three/terrain/terrain-fog-field.ts");

    expect(fogField).toContain("new PlaneGeometry(1, 1, 1, 1)");
    expect(fogField).toContain("writeTerrainFogMaskRegion(mask, this.renderedInstances.values(), region)");
    expect(fogField).toContain("mix(frontierOpacity, float(TERRAIN_DEEP_FOG_OPACITY), deepFog)");
    expect(fogField).not.toContain("uv().add(");
    expect(fogField).not.toContain("InstancedMesh");
    expect(fogField).not.toContain("terrain-exploration-shroud-frontier");
  });

  it("keeps fog off resident materials and draws one grid at the unknown selection height", () => {
    const fogField = source("src/three/terrain/terrain-fog-field.ts");
    const terrain = source("src/three/terrain/procedural-terrain.ts");
    expect(fogField).not.toContain("applyToTerrain");
    expect(terrain).not.toContain("fogField.applyToTerrain");
    expect(fogField).toContain("const FOG_PLANE_HEIGHT = TERRAIN_FOG_GROUND_HEIGHT");
    expect(fogField).toContain("material.colorNode = shadeFogHexBoundary(fogColor, fogGround.xz)");
  });

  it("keeps mask animation in the fog field while terrain authority remains external", () => {
    const fogField = source("src/three/terrain/terrain-fog-field.ts");
    const terrain = source("src/three/terrain/procedural-terrain.ts");

    expect(fogField).toContain("this.reveal.update(deltaSeconds)");
    expect(terrain).toContain("this.fogField.queueReveal(col, row, source)");
    expect(terrain).toContain("this.fogField.updateAnimation(deltaSeconds)");
  });

  it("shares one deep-fog color across the mist and debug background", () => {
    const debugRenderer = source("src/three/debug/procedural-terrain-debug-renderer.ts");
    const fogField = source("src/three/terrain/terrain-fog-field.ts");
    const style = source("src/three/terrain/terrain-fog-style.ts");

    expect(debugRenderer).toContain("TERRAIN_DEEP_FOG_COLOR");
    expect(fogField).toContain("TERRAIN_DEEP_FOG_COLOR");
    expect(style).toContain('TERRAIN_DEEP_FOG_COLOR = "#191b1e"');
    expect(style).toContain("TERRAIN_DEEP_FOG_OPACITY = 1");
  });

  it("reports the worst reveal commit instead of summing separate presentation frames", () => {
    const debugRenderer = source("src/three/debug/procedural-terrain-debug-renderer.ts");

    expect(debugRenderer).toContain("commitMs = Math.max(commitMs, performance.now() - commitStartedAt)");
    expect(debugRenderer).not.toContain("commitMs += performance.now() - commitStartedAt");
  });

  it("prepares the global coverage mask on the terrain worker before the atomic worldmap commit", () => {
    const worldmapTerrain = source("src/three/terrain/worldmap-procedural-terrain.ts");
    const prepareMask = worldmapTerrain.indexOf("await this.terrain.prepareFogMaskAsync(nextPages)");
    const commit = worldmapTerrain.indexOf("this.terrain.commitPages(", prepareMask);

    expect(prepareMask).toBeGreaterThan(0);
    expect(prepareMask).toBeLessThan(commit);
  });
});
