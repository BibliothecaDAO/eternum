import {
  BufferAttribute,
  BufferGeometry,
  InterleavedBuffer,
  InterleavedBufferAttribute,
  Float32BufferAttribute,
  Uint8BufferAttribute,
  Vector3,
} from "three";

const CRACK = [
  [-0.1, -1.05],
  [-0.17, -0.78],
  [-0.02, -0.54],
  [-0.1, -0.31],
  [0.04, -0.08],
  [-0.02, 0.17],
  [0.16, 0.39],
  [0.04, 0.65],
  [0.13, 0.91],
  [0.06, 1.08],
] as const;
const BRANCHES = [
  [
    [-0.02, -0.54],
    [-0.35, -0.34],
    [-0.52, -0.42],
    [-0.8, -0.24],
  ],
  [
    [0.16, 0.39],
    [0.36, 0.25],
    [0.5, 0.34],
    [0.79, 0.11],
  ],
] as const;
const MAX_DEPTH = 0.34;
const smooth = (a: number, b: number, value: number) => {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** The same field supplies the carved geometry and its surface attributes; snow cannot become a cover layer. */
export function sampleRiftGround(x: number, z: number) {
  const radius = Math.hypot(x, z);
  const angle = Math.atan2(z, x);
  const fingers = Math.max(0, Math.sin(angle * 7 + Math.sin(angle * 3) * 0.8)) ** 10;
  const reach = 1.08 + fingers * 0.55 + Math.sin(x * 27 + z * 19) * 0.025;
  const coverage = 1 - smooth(reach - 0.065, reach + 0.065, radius);
  const distance = Math.min(polylineDistance(x, z, CRACK), ...BRANCHES.map((line) => polylineDistance(x, z, line)));
  const end = 1 - smooth(0.85, 1.12, radius);
  const depth = MAX_DEPTH * (1 - smooth(0.025, 0.135, distance)) * end;
  const floor = (1 - smooth(0.028, 0.06, distance)) * end;
  return { coverage, depth, floor };
}

function polylineDistance(x: number, z: number, points: readonly (readonly [number, number])[]) {
  let closest = Infinity;
  for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1],
      [bx, bz] = points[i];
    const dx = bx - ax,
      dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    closest = Math.min(closest, Math.hypot(x - ax - t * dx, z - az - t * dz));
  }
  return closest;
}

/** Refine only the rift's neighborhood, keeping the terrain's own attributes and unchanged distant triangles. */
export function createRiftGroundGeometry(source: BufferGeometry) {
  const attributes = Object.entries(source.attributes);
  const values = new Map(
    attributes.map(([name, attribute]) => [
      name,
      Array.from({ length: attribute.count * attribute.itemSize }, (_, i) =>
        attribute.getComponent(Math.floor(i / attribute.itemSize), i % attribute.itemSize),
      ),
    ]),
  );
  const positions = values.get("position")!;
  const index = source.index;
  if (!index) throw new Error("Rift ground requires indexed terrain");
  const triangles: number[] = [];
  const midpoints = new Map<string, number>();
  const midpoint = (a: number, b: number) => {
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    const found = midpoints.get(key);
    if (found !== undefined) return found;
    const next = positions.length / 3;
    for (const [name, attribute] of attributes) {
      const data = values.get(name)!;
      for (let c = 0; c < attribute.itemSize; c++)
        data.push((data[a * attribute.itemSize + c] + data[b * attribute.itemSize + c]) / 2);
    }
    midpoints.set(key, next);
    return next;
  };
  const split = (a: number, b: number, c: number, level: number) => {
    const near = [a, b, c].some((i) => Math.hypot(positions[i * 3], positions[i * 3 + 2]) < 1.9);
    const detail = [a, b, c].some((i) => {
      const field = sampleRiftGround(positions[i * 3], positions[i * 3 + 2]);
      return field.depth > 0 || (field.coverage > 0 && field.coverage < 1);
    });
    if (!near || level === 0 || (level === 1 && !detail)) {
      triangles.push(a, b, c);
      return;
    }
    const ab = midpoint(a, b),
      bc = midpoint(b, c),
      ca = midpoint(c, a);
    split(a, ab, ca, level - 1);
    split(ab, b, bc, level - 1);
    split(ca, bc, c, level - 1);
    split(ab, bc, ca, level - 1);
  };
  for (let i = 0; i < index.count; i += 3) split(index.getX(i), index.getX(i + 1), index.getX(i + 2), 4);
  const normals = values.get("normal")!;
  const field: number[] = [];
  const normal = new Vector3();
  let deepest = 0;
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i],
      z = positions[i + 2];
    const sample = sampleRiftGround(x, z);
    positions[i + 1] -= sample.depth;
    deepest = Math.max(deepest, sample.depth);
    if (sample.depth > 0) {
      const dx = (sampleRiftGround(x + 0.005, z).depth - sampleRiftGround(x - 0.005, z).depth) / 0.01;
      const dz = (sampleRiftGround(x, z + 0.005).depth - sampleRiftGround(x, z - 0.005).depth) / 0.01;
      normal.set(normals[i] / normals[i + 1] + dx, 1, normals[i + 2] / normals[i + 1] + dz).normalize();
      normal.toArray(normals, i);
    }
    field.push(
      Math.round(sample.coverage * 255),
      Math.round((sample.depth / MAX_DEPTH) * 255),
      Math.round(sample.floor * 255),
      255,
    );
  }
  const geometry = new BufferGeometry();
  for (const [name, attribute] of attributes) {
    if (name === "position" || name === "normal") continue;
    const data = values.get(name)!;
    geometry.setAttribute(
      name,
      attribute.normalized && attribute.array instanceof Uint8Array
        ? new Uint8BufferAttribute(
            data.map((value) => Math.round(value * 255)),
            attribute.itemSize,
            true,
          )
        : new Float32BufferAttribute(data, attribute.itemSize),
    );
  }
  const vectors = new Float32Array(positions.length * 2);
  for (let i = 0; i < positions.length / 3; i++) {
    vectors.set(positions.slice(i * 3, i * 3 + 3), i * 6);
    vectors.set(normals.slice(i * 3, i * 3 + 3), i * 6 + 3);
  }
  const sharedVectors = new InterleavedBuffer(vectors, 6);
  geometry.setAttribute("position", new InterleavedBufferAttribute(sharedVectors, 3, 0));
  geometry.setAttribute("normal", new InterleavedBufferAttribute(sharedVectors, 3, 3));
  geometry.setAttribute("riftGround", new Uint8BufferAttribute(field, 4, true));
  geometry.setIndex(new BufferAttribute(new Uint32Array(triangles), 1));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.riftDepth = deepest;
  return geometry;
}

export function riftGeometryBytes(geometry: BufferGeometry) {
  const arrays = new Set(Object.values(geometry.attributes).map((attribute) => attribute.array));
  return [...arrays].reduce((sum, array) => sum + array.byteLength, 0) + (geometry.index?.array.byteLength ?? 0);
}
