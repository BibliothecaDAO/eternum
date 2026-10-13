import { describe, expect, it } from "vitest";

import { createCasedHexagonBandGeometry } from "./hexagon-geometry";

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
