import { describe, expect, it } from "vitest";

import {
  BASALT_BLOCK_RADIUS,
  BASALT_SUPPORT_HEIGHT,
  basaltVariantForCell,
  buildBasaltTemplate,
  sampleBasaltSurface,
} from "./terrain-basalt";
import { terrainHexCorners, terrainHexToWorld } from "./terrain-coordinates";

type Geometry = ReturnType<typeof buildBasaltCell>;
type Vertex = readonly [number, number, number];

describe("ethereal basalt terrain", () => {
  it("is deterministic across repeated builds, including negative coordinates", () => {
    for (const [col, row] of [
      [0, 0],
      [-3, -5],
      [4, -2],
    ]) {
      expect(buildBasaltCell(col, row, false)).toEqual(buildBasaltCell(col, row, false));
      expect(buildBasaltCell(col, row, true)).toEqual(buildBasaltCell(col, row, true));
    }
    expect(buildBasaltCell(0, 0, false)).not.toEqual(buildBasaltCell(-3, -5, false));
  });

  it("clips every face to its exact gameplay hex in both coordinate directions", () => {
    for (const [col, row] of [
      [0, 0],
      [-3, -5],
      [4, -2],
      [111, 222],
    ]) {
      const boundary = terrainHexCorners(col, row);
      for (const occupied of [false, true]) {
        const geometry = buildBasaltCell(col, row, occupied);
        for (let vertex = 0; vertex < geometry.positions.length; vertex += 3) {
          const [x, , z] = geometry.positions.slice(vertex, vertex + 3);
          for (let edge = 0; edge < 6; edge += 1) {
            const start = boundary[edge];
            const end = boundary[(edge + 1) % 6];
            const cross = (end.x - start.x) * (z - start.z) - (end.z - start.z) * (x - start.x);
            expect(cross).toBeGreaterThanOrEqual(-2e-6);
          }
        }
      }
    }
  });

  it("uses regular six-sided caps at the spire's block pitch", () => {
    const geometry = buildBasaltCell(0, 0, false);
    const centerHeight = sampleBasaltSurface(0, 0, false).height;
    const unique = new Map<string, Vertex>();
    for (let index = 0; index < geometry.positions.length / 3; index += 1) {
      const point = vertexAt(geometry, index);
      if (Math.abs(point[1] - centerHeight) < 1e-10 && Math.hypot(point[0], point[2]) < 0.15)
        unique.set(`${point[0]}:${point[2]}`, point);
    }
    const cap = [...unique.values()];
    expect(cap).toHaveLength(6);
    const radii = cap.map(([x, , z]) => Math.hypot(x, z));
    expect(Math.max(...radii) - Math.min(...radii)).toBeLessThan(1e-10);
    expect(radii[0]).toBeCloseTo(BASALT_BLOCK_RADIUS - 0.008, 10);
    const sorted = cap.toSorted((a, b) => Math.atan2(a[2], a[0]) - Math.atan2(b[2], b[0]));
    for (let index = 0; index < 6; index += 1) {
      const a = sorted[index];
      const b = sorted[(index + 1) % 6];
      expect(Math.hypot(b[0] - a[0], b[2] - a[2])).toBeCloseTo(radii[0], 10);
    }
  });

  it("keeps occupied terrain perfectly level with complete, non-overlapping support", () => {
    for (const [col, row] of [
      [0, 0],
      [-3, -5],
      [4, -2],
    ]) {
      const geometry = buildBasaltCell(col, row, true);
      let area = 0;
      forEachTriangle(geometry, (a, b, c, index) => {
        if (geometry.normals[index * 3 + 1] === 0) return;
        for (const point of [a, b, c]) expect(point[1]).toBe(BASALT_SUPPORT_HEIGHT);
        area += projectedArea(a, b, c);
        const center = centroid(a, b, c);
        expect(sampleBasaltSurface(center[0], center[2], true)).toEqual({
          height: BASALT_SUPPORT_HEIGHT,
          normal: [0, 1, 0],
        });
      });
      expect(area).toBeCloseTo(polygonArea(terrainHexCorners(col, row)), 5);
    }
  });

  it("aligns sampled heights and normals with visible cap and bevel triangles", () => {
    for (const [col, row] of [
      [0, 0],
      [-3, -5],
      [4, -2],
    ]) {
      const geometry = buildBasaltCell(col, row, false);
      let bevelCount = 0;
      forEachTriangle(geometry, (a, b, c, index) => {
        const normal = geometry.normals.slice(index * 3, index * 3 + 3);
        // The single recessed joint floor also runs beneath the columns.
        if (normal[1] <= 0 || (a[1] === 0.075 && b[1] === 0.075 && c[1] === 0.075)) return;
        const center = centroid(a, b, c);
        const sample = sampleBasaltSurface(center[0], center[2], false);
        expect(sample.height).toBeCloseTo(center[1], 5);
        sample.normal.forEach((component, axis) => expect(component).toBeCloseTo(normal[axis], 5));
        if (normal[1] < 0.99) bevelCount += 1;
      });
      expect(bevelCount).toBeGreaterThan(0);
    }
  });

  it("uses shallow height variation, recessed narrow joints, and dark non-emissive colors", () => {
    const heights = [];
    for (let row = -3; row <= 3; row += 1) {
      for (let col = -3; col <= 3; col += 1) {
        const x = Math.sqrt(3) * BASALT_BLOCK_RADIUS * (col + row / 2);
        const z = 1.5 * BASALT_BLOCK_RADIUS * row;
        const sample = sampleBasaltSurface(x, z, false);
        heights.push(sample.height);
        expect(sample.normal).toEqual([0, 1, 0]);
      }
    }
    expect(Math.min(...heights)).toBeGreaterThanOrEqual(0.09);
    expect(Math.max(...heights)).toBeLessThanOrEqual(0.13);
    expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(0.02);
    expect(sampleBasaltSurface((Math.sqrt(3) * BASALT_BLOCK_RADIUS) / 2, 0, false).height).toBe(0.075);
    expect(buildBasaltCell(0, 0, false).colors.every((value) => value > 0 && value < 0.06)).toBe(true);
  });

  it("keeps the lattice aligned across neighboring gameplay hexes", () => {
    const left = buildBasaltCell(-1, -1, false);
    const right = buildBasaltCell(0, -1, false);
    const leftCenter = terrainHexToWorld(-1, -1);
    const rightCenter = terrainHexToWorld(0, -1);
    const edgeX = (leftCenter.x + rightCenter.x) / 2;
    const edgeVertices = (geometry: Geometry) => {
      const heights = new Set<number>();
      for (let index = 0; index < geometry.positions.length / 3; index += 1) {
        const [x, y] = vertexAt(geometry, index);
        if (Math.abs(x - edgeX) < 1e-6 && y > 0.075) heights.add(Math.round(y * 1e8));
      }
      return [...heights].sort((a, b) => a - b);
    };
    expect(edgeVertices(left).length).toBeGreaterThan(2);
    expect(edgeVertices(left)).toEqual(edgeVertices(right));
  });

  it("chooses the upper shoulder consistently at exact vertical steps", () => {
    for (const [col, row] of [
      [0, 0],
      [-9, -7],
      [23, 17],
    ]) {
      const x = Math.sqrt(3) * BASALT_BLOCK_RADIUS * (col + row / 2);
      const z = 1.5 * BASALT_BLOCK_RADIUS * row;
      const capHeight = sampleBasaltSurface(x, z, false).height;
      const edgeX = x + ((BASALT_BLOCK_RADIUS - 0.004) * Math.sqrt(3)) / 2;
      expect(sampleBasaltSurface(edgeX, z, false).height).toBeCloseTo(capHeight - 0.004, 10);
      expect(sampleBasaltSurface(edgeX + 1e-7, z, false).height).toBe(0.075);
    }
  });

  it("closes exposed gameplay borders from the sampled surface to the joint floor", () => {
    for (const [col, row] of [
      [0, 0],
      [-3, -5],
    ]) {
      const boundary = terrainHexCorners(col, row);
      const center = terrainHexToWorld(col, row);
      for (const occupied of [false, true]) {
        const geometry = buildBasaltCell(col, row, occupied);
        for (let edge = 0; edge < boundary.length; edge += 1) {
          const start = boundary[edge];
          const end = boundary[(edge + 1) % boundary.length];
          const direction = { x: end.x - start.x, z: end.z - start.z };
          const edgeLength = Math.hypot(direction.x, direction.z);
          const walls: Array<[Vertex, Vertex, Vertex]> = [];
          forEachTriangle(geometry, (a, b, c, index) => {
            const points = [a, b, c] as [Vertex, Vertex, Vertex];
            if (geometry.normals[index * 3 + 1] !== 0) return;
            const onEdge = points.every(
              ([x, , z]) => Math.abs(direction.x * (z - start.z) - direction.z * (x - start.x)) < 1e-9,
            );
            if (!onEdge) return;
            walls.push(points);
            const middle = centroid(a, b, c);
            const normal = geometry.normals.slice(index * 3, index * 3 + 3);
            expect(normal[0] * (middle[0] - center.x) + normal[2] * (middle[2] - center.z)).toBeGreaterThan(0);
            expect(Math.min(a[1], b[1], c[1])).toBe(0.075);
            for (const [x, y, z] of points) {
              if (y > 0.075) {
                // Shared template transforms differ from snapped map corners by at most a micron.
                const nearby = [-2e-6, 0, 2e-6].flatMap((dx) =>
                  [-2e-6, 0, 2e-6].map((dz) => sampleBasaltSurface(x + dx, z + dz, occupied).height),
                );
                expect(Math.min(...nearby.map((height) => Math.abs(height - y)))).toBeLessThan(1e-5);
              }
            }
          });
          expect(walls.length).toBeGreaterThan(0);
          if (occupied) {
            const area = walls.reduce((sum, [a, b, c]) => sum + verticalArea(a, b, c), 0);
            expect(area).toBeCloseTo(edgeLength * (BASALT_SUPPORT_HEIGHT - 0.075), 9);
          }
        }
      }
    }
  });

  it("produces finite, consistently wound batch geometry without degenerate triangles", () => {
    for (const occupied of [false, true]) {
      const geometry = buildBasaltCell(0, 0, occupied);
      expect(geometry.normals.length).toBe(geometry.positions.length);
      expect(geometry.colors.length).toBe(geometry.positions.length);
      expect(geometry.positions.every(Number.isFinite)).toBe(true);
      expect(geometry.normals.every(Number.isFinite)).toBe(true);
      expect(geometry.indices.length / 3).toBeLessThan(2200);
      forEachTriangle(geometry, (a, b, c, index) => {
        const cross = [
          (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]),
          (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]),
          (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]),
        ];
        const normal = geometry.normals.slice(index * 3, index * 3 + 3);
        expect(cross.reduce((sum, value, axis) => sum + value * normal[axis], 0)).toBeGreaterThan(0);
      });
    }
  });
});

function vertexAt(geometry: Geometry, index: number): Vertex {
  return geometry.positions.slice(index * 3, index * 3 + 3) as [number, number, number];
}

function forEachTriangle(
  geometry: Geometry,
  visit: (a: Vertex, b: Vertex, c: Vertex, firstIndex: number) => void,
): void {
  for (let index = 0; index < geometry.indices.length; index += 3) {
    const indices = geometry.indices.slice(index, index + 3);
    visit(vertexAt(geometry, indices[0]), vertexAt(geometry, indices[1]), vertexAt(geometry, indices[2]), indices[0]);
  }
}

function centroid(a: Vertex, b: Vertex, c: Vertex): Vertex {
  return [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
}

function projectedArea(a: Vertex, b: Vertex, c: Vertex): number {
  return Math.abs((b[0] - a[0]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[0] - a[0])) / 2;
}

function verticalArea(a: Vertex, b: Vertex, c: Vertex): number {
  return (
    Math.hypot(
      (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]),
      (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]),
    ) / 2
  );
}

function polygonArea(points: Array<{ x: number; z: number }>): number {
  return (
    points.reduce((area, point, index) => {
      const next = points[(index + 1) % points.length];
      return area + point.x * next.z - next.x * point.z;
    }, 0) / 2
  );
}

function buildBasaltCell(col: number, row: number, occupied: boolean): ReturnType<typeof buildBasaltTemplate> {
  const geometry = buildBasaltTemplate(basaltVariantForCell(col, row), occupied);
  const center = terrainHexToWorld(col, row);
  for (let index = 0; index < geometry.positions.length; index += 3) {
    geometry.positions[index] += center.x;
    geometry.positions[index + 2] += center.z;
  }
  return geometry;
}
