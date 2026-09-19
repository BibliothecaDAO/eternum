import { describe, expect, it } from "vitest";
import {
  BASALT_SUPPORT_HEIGHT,
  BASALT_SHELL_TRIANGLES,
  BASALT_SHELL_VERTICES,
  buildBasaltShell,
  sampleBasaltSurface,
} from "./terrain-basalt";
import { terrainHexCorners } from "./terrain-coordinates";
import { createEtherealTerrainMaterial } from "./terrain-ethereal-material";

describe("flat ethereal basalt", () => {
  it("uses one deterministic shell with one flat walkable plane", () => {
    const geometry = buildBasaltShell();
    expect(geometry).toEqual(buildBasaltShell());
    const support = sampleBasaltSurface();
    expect(support).toEqual({ height: 0.12, normal: [0, 1, 0] });
    let topArea = 0;
    for (let index = 0; index < geometry.indices.length; index += 3) {
      const indices = geometry.indices.slice(index, index + 3);
      if (geometry.normals[indices[0] * 3 + 1] === 0) continue;
      const [a, b, c] = indices.map((vertex) => geometry.positions.slice(vertex * 3, vertex * 3 + 3));
      for (const point of [a, b, c]) expect(point[1]).toBe(support.height);
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

  it("closes all six outer edges with outward walls and consistent triangle winding", () => {
    const geometry = buildBasaltShell();
    const wallNormals = new Set<string>();
    for (let index = 0; index < geometry.indices.length; index += 3) {
      const indices = geometry.indices.slice(index, index + 3);
      const [a, b, c] = indices.map((vertex) => geometry.positions.slice(vertex * 3, vertex * 3 + 3));
      const normal = geometry.normals.slice(indices[0] * 3, indices[0] * 3 + 3);
      const cross = [
        (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]),
        (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]),
        (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]),
      ];
      expect(cross.reduce((sum, value, axis) => sum + value * normal[axis], 0)).toBeGreaterThan(0);
      if (normal[1] === 0) {
        wallNormals.add(normal.join(":"));
        expect(normal[0] * (a[0] + b[0] + c[0]) + normal[2] * (a[2] + b[2] + c[2])).toBeGreaterThan(0);
        expect(Math.min(a[1], b[1], c[1])).toBe(0.075);
        expect(Math.max(a[1], b[1], c[1])).toBe(BASALT_SUPPORT_HEIGHT);
      }
    }
    expect(wallNormals.size).toBe(6);
  });

  it("keeps the shared render resource below two KiB with no per-slab geometry", () => {
    const geometry = buildBasaltShell();
    expect(geometry.positions.length / 3).toBe(BASALT_SHELL_VERTICES);
    expect(geometry.indices.length / 3).toBe(BASALT_SHELL_TRIANGLES);
    const bytes =
      (geometry.positions.length + geometry.normals.length + geometry.colors.length) * 4 + geometry.indices.length * 2;
    expect(bytes).toBe(1176);
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
