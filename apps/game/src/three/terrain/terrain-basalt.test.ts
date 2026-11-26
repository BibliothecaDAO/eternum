import { setWorldOrigin, worldOrigin } from "../world-origin";
import { describe, expect, it } from "vitest";
import { BASALT_SHELL_TRIANGLES, BASALT_SHELL_VERTICES, buildBasaltShell } from "./terrain-basalt";
import { TERRAIN_GROUND_HEIGHT } from "./terrain-surface";
import { terrainHexCorners } from "./terrain-coordinates";
import { createEtherealTerrainMaterial } from "./terrain-ethereal-material";

describe("flat ethereal basalt", () => {
  it("keeps the shared shell local when Frontier moves its floating origin", () => {
    const previous = worldOrigin();
    try {
      setWorldOrigin({ col: 0, row: 0 });
      const original = buildBasaltShell();
      setWorldOrigin({ col: -2147482996, row: -2147483498 });
      const frontier = buildBasaltShell();
      expect(frontier).toEqual(original);
      expect(Math.max(...frontier.positions.map(Math.abs))).toBeLessThanOrEqual(1);
    } finally {
      setWorldOrigin(previous);
    }
  });

  it("uses one deterministic shell with one flat walkable plane", () => {
    const geometry = buildBasaltShell();
    expect(geometry).toEqual(buildBasaltShell());
    let topArea = 0;
    for (let index = 0; index < geometry.indices.length; index += 3) {
      const indices = geometry.indices.slice(index, index + 3);
      if (geometry.normals[indices[0] * 3 + 1] === 0) continue;
      const [a, b, c] = indices.map((vertex) => geometry.positions.slice(vertex * 3, vertex * 3 + 3));
      for (const point of [a, b, c]) expect(point[1]).toBe(TERRAIN_GROUND_HEIGHT);
      topArea += Math.abs((b[0] - a[0]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[0] - a[0])) / 2;
    }
    const corners = terrainHexCorners(0, 0);
    const expectedArea =
      corners.reduce((sum, corner, index) => {
        const next = corners[(index + 1) % 6];
        return sum + corner.x * next.z - next.x * corner.z;
      }, 0) / 2;
    expect(topArea).toBeCloseTo(expectedArea, 10);
  });

  it("is only its walkable cap, flush with the mist around it, facing up", () => {
    const geometry = buildBasaltShell();
    expect(geometry.normals.every((value, index) => value === (index % 3 === 1 ? 1 : 0))).toBe(true);
    expect(geometry.positions.filter((_, index) => index % 3 === 1).every((y) => y === TERRAIN_GROUND_HEIGHT)).toBe(
      true,
    );
  });

  it("keeps the shared render resource below two KiB with no per-slab geometry", () => {
    const geometry = buildBasaltShell();
    expect(geometry.positions.length / 3).toBe(BASALT_SHELL_VERTICES);
    expect(geometry.indices.length / 3).toBe(BASALT_SHELL_TRIANGLES);
    const bytes =
      (geometry.positions.length + geometry.normals.length + geometry.colors.length) * 4 + geometry.indices.length * 2;
    expect(bytes).toBe(240);
  });

  it("uses surface color only, without emission or geometry/normal displacement", () => {
    const material = createEtherealTerrainMaterial();
    expect(material.colorNode).not.toBeNull();
    expect(material.positionNode).toBeNull();
    expect(material.normalNode).toBeNull();
    expect(material.emissiveNode).toBeNull();
    expect(material.emissive.getHex()).toBe(0);
    material.dispose();
  });
});
