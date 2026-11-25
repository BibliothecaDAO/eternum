import { BufferGeometry, Float32BufferAttribute } from "three";

const hexagonCorner = (radius: number, corner: number): [number, number] => {
  const angle = (Math.PI / 3) * corner - Math.PI / 2;
  return [radius * Math.cos(angle), radius * Math.sin(angle)];
};

/**
 * A hexagon line that reads on any ground: a light core between two dark casings, as vertex colours. On pale ground
 * (snow, sand) the casings carry it; on dark ground the core does. Faces +Z like the shape geometries.
 */
export const createCasedHexagonBandGeometry = (
  outerRadius: number,
  innerRadius: number,
  casing: number,
  colors: { core: readonly [number, number, number]; casing: readonly [number, number, number] },
): BufferGeometry => {
  const bands = [
    { from: innerRadius - casing, to: innerRadius, color: colors.casing },
    { from: innerRadius, to: outerRadius, color: colors.core },
    { from: outerRadius, to: outerRadius + casing, color: colors.casing },
  ];
  const positions: number[] = [];
  const vertexColors: number[] = [];
  for (const { from, to, color } of bands) {
    for (let corner = 0; corner < 6; corner++) {
      const [innerA, outerA, innerB, outerB] = [
        hexagonCorner(from, corner),
        hexagonCorner(to, corner),
        hexagonCorner(from, corner + 1),
        hexagonCorner(to, corner + 1),
      ];
      for (const [x, y] of [innerA, outerA, outerB, innerA, outerB, innerB]) {
        positions.push(x, y, 0);
        vertexColors.push(...color);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(vertexColors, 3));
  return geometry;
};

const GROUND_GRID_RINGS = 3;

const hexGridPoint = (radius: number, ring: number, index: number): [number, number] => {
  if (ring === 0) return [0, 0];
  const side = Math.floor(index / ring);
  const [ax, ay] = hexagonCorner((radius * ring) / GROUND_GRID_RINGS, side);
  const [bx, by] = hexagonCorner((radius * ring) / GROUND_GRID_RINGS, side + 1);
  const along = (index % ring) / ring;
  return [ax + (bx - ax) * along, ay + (by - ay) * along];
};

const hexGridIndex = (ring: number, index: number): number =>
  ring === 0 ? 0 : 1 + 3 * ring * (ring - 1) + (index % (6 * ring));

const hexGrid = (radius: number): { points: [number, number][]; triangles: number[] } => {
  const points: [number, number][] = [];
  const triangles: number[] = [];
  for (let ring = 0; ring <= GROUND_GRID_RINGS; ring++)
    for (let index = 0; index < Math.max(1, 6 * ring); index++) points.push(hexGridPoint(radius, ring, index));
  for (let ring = 1; ring <= GROUND_GRID_RINGS; ring++)
    for (let side = 0; side < 6; side++)
      for (let step = 0; step < ring; step++) {
        const outer = side * ring + step;
        const inner = hexGridIndex(ring - 1, side * (ring - 1) + step);
        triangles.push(inner, hexGridIndex(ring, outer), hexGridIndex(ring, outer + 1));
        if (step < ring - 1)
          triangles.push(inner, hexGridIndex(ring, outer + 1), hexGridIndex(ring - 1, side * (ring - 1) + step + 1));
      }
  return { points, triangles };
};

export const createHexPlateGeometry = (radius: number): BufferGeometry => {
  const { points, triangles } = hexGrid(radius);
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(
      points.flatMap(([x, y]) => [x, y, 0]),
      3,
    ),
  );
  geometry.setIndex(triangles);
  return geometry;
};

export const createFilledHexagonOverlayGeometry = (
  outerRadius: number,
  innerRadius: number,
  colors: {
    fill: readonly [number, number, number, number];
    rim: readonly [number, number, number, number];
  },
): BufferGeometry => {
  const fill = hexGrid(innerRadius);
  const edge = 6 * GROUND_GRID_RINGS;
  const rimInner = Array.from({ length: edge }, (_, index) => hexGridPoint(innerRadius, GROUND_GRID_RINGS, index));
  const rimOuter = Array.from({ length: edge }, (_, index) => hexGridPoint(outerRadius, GROUND_GRID_RINGS, index));
  const points = [...fill.points, ...rimInner, ...rimOuter];
  const innerAt = (index: number) => fill.points.length + (index % edge);
  const outerAt = (index: number) => fill.points.length + edge + (index % edge);
  const rim = Array.from({ length: edge }, (_, index) => [
    innerAt(index),
    outerAt(index),
    outerAt(index + 1),
    innerAt(index),
    outerAt(index + 1),
    innerAt(index + 1),
  ]).flat();
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(
      points.flatMap(([x, y]) => [x, y, 0]),
      3,
    ),
  );
  geometry.setAttribute(
    "color",
    new Float32BufferAttribute(
      points.flatMap((_, index) => [...(index < fill.points.length ? colors.fill : colors.rim)]),
      4,
    ),
  );
  geometry.setIndex([...fill.triangles, ...rim]);
  return geometry;
};
