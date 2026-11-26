import { describe, expect, it } from "vitest";

import { createCasedHexagonBandGeometry, createFilledHexagonOverlayGeometry } from "./hexagon-geometry";

const CORE = [0.9, 0.9, 0.9] as const;
const CASING = [0.1, 0.1, 0.1] as const;

describe("the cased hexagon band", () => {
  const geometry = createCasedHexagonBandGeometry(1, 0.9, 0.05, { core: CORE, casing: CASING });
  const positions = geometry.getAttribute("position");
  const colors = geometry.getAttribute("color");
  const vertices = Array.from({ length: positions.count }, (_, index) => ({
    radius: Math.hypot(positions.getX(index), positions.getY(index)),
    tone: colors.getX(index),
  }));

  it("lays a light core between two dark casings", () => {
    const toned = (tone: number) => vertices.filter((vertex) => Math.abs(vertex.tone - tone) < 1e-6);
    const within = (radius: number, from: number, to: number) => radius > from - 1e-6 && radius < to + 1e-6;
    // Six quads a band, two triangles a quad.
    expect(toned(CORE[0])).toHaveLength(36);
    expect(toned(CASING[0])).toHaveLength(72);
    expect(toned(CORE[0]).every(({ radius }) => within(radius, 0.9, 1))).toBe(true);
    expect(toned(CASING[0]).every(({ radius }) => within(radius, 0.85, 0.9) || within(radius, 1, 1.05))).toBe(true);
  });

  it("faces the same way as the flat hex shapes, so one rotation lays both on the ground", () => {
    // Counter-clockwise in XY: the first triangle's normal points to +Z.
    const [a, b, c] = [0, 1, 2].map((index) => [positions.getX(index), positions.getY(index)] as const);
    const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    expect(cross).toBeGreaterThan(0);
  });
});

describe("the filled hexagon plot overlay", () => {
  const fill = [0.02, 0.45, 0.09, 0.34] as const;
  const rim = [0.01, 0.32, 0.07, 0.78] as const;
  const geometry = createFilledHexagonOverlayGeometry(1, 0.9, { fill, rim });
  const positions = geometry.getAttribute("position");
  const colors = geometry.getAttribute("color");
  const index = geometry.getIndex()!;
  const radiusOf = (vertex: number) => Math.hypot(positions.getX(vertex), positions.getY(vertex));

  it("fills the interior with translucent fill RGBA, framed with rim RGBA, facing +Z", () => {
    expect(colors.itemSize).toBe(4);
    const vertices = Array.from({ length: positions.count }, (_, vertex) => vertex);
    const fillVertices = vertices.filter((vertex) => Math.abs(colors.getW(vertex) - fill[3]) < 1e-5);
    const rimVertices = vertices.filter((vertex) => Math.abs(colors.getW(vertex) - rim[3]) < 1e-5);
    expect(fillVertices).toHaveLength(7);
    expect(rimVertices).toHaveLength(12);
    expect(fillVertices.every((vertex) => radiusOf(vertex) < 0.9 + 1e-6)).toBe(true);
    expect(fillVertices.filter((vertex) => radiusOf(vertex) < 0.9 * 0.34)).toHaveLength(1);
    expect(
      rimVertices.every(
        (vertex) => radiusOf(vertex) > 0.9 * Math.cos(Math.PI / 6) - 1e-6 && radiusOf(vertex) < 1 + 1e-6,
      ),
    ).toBe(true);
    expect(index.count / 3).toBe(6 + 12);
    for (let triangle = 0; triangle < index.count; triangle += 3) {
      const [a, b, c] = [0, 1, 2].map(
        (corner) =>
          [positions.getX(index.getX(triangle + corner)), positions.getY(index.getX(triangle + corner))] as const,
      );
      expect((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])).toBeGreaterThan(0);
    }
  });
});
