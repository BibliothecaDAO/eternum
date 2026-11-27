export type Vec3 = readonly [number, number, number];

export interface FloraMeshData {
  positions: number[];
  normals: number[];
  colours: number[];
  bend: number[];
  foliage: number[];
  glow: number[];
}

export interface LumpSpec {
  readonly centre: Vec3;
  readonly radius: number;
  readonly squash?: number;
  readonly coarse?: boolean;
}

interface TriangleOptions {
  readonly normals?: readonly [Vec3, Vec3, Vec3] | null;
  readonly foliage?: boolean;
  readonly glow?: number;
}

interface FrustumOptions {
  readonly from: Vec3;
  readonly to: Vec3;
  readonly fromRadius: number;
  readonly toRadius: number;
  readonly sides: number;
  readonly colour: Vec3;
  readonly rng: () => number;
  readonly twist?: number;
  readonly jag?: number;
  readonly bend?: (corner: Vec3) => number;
  readonly foliage?: boolean;
  readonly glow?: number;
}

interface SkirtOptions {
  readonly centre: Vec3;
  readonly innerRadius: number;
  readonly outerRadius: number;
  readonly top: number;
  readonly bottom: number;
  readonly sides: number;
  readonly notch: number;
  readonly rng: () => number;
  readonly light: Vec3;
  readonly dark: Vec3;
  readonly under: Vec3;
  readonly bend: (corner: Vec3) => number;
}

interface FrondOptions {
  readonly base: Vec3;
  readonly angle: number;
  readonly length: number;
  readonly width: number;
  readonly rng: () => number;
  readonly light: Vec3;
  readonly dark: Vec3;
  readonly steps: number;
  readonly lift: number;
  readonly droop?: number;
  readonly floor?: number;
  readonly rise?: number;
  readonly glow?: number;
}

interface LumpOptions {
  readonly rng: () => number;
  readonly roughness: number;
  readonly light: Vec3;
  readonly dark: Vec3;
  readonly attach?: Vec3 | null;
  readonly reach?: number;
  readonly rise?: number;
  readonly neighbours?: readonly LumpSpec[];
  readonly flat?: boolean;
  readonly foliage?: boolean;
  readonly glow?: number;
}

interface SubdividedSphere {
  readonly vertices: readonly Vec3[];
  readonly faces: readonly (readonly [number, number, number])[];
}

const HIDDEN_FROM_MAP_CAMERA = -0.7;
const DEGENERATE_TRIANGLE_EPSILON = 1e-10;

export function linearColour(hex: string): Vec3 {
  return [
    (parseInt(hex.slice(1, 3), 16) / 255) ** 2.2,
    (parseInt(hex.slice(3, 5), 16) / 255) ** 2.2,
    (parseInt(hex.slice(5, 7), 16) / 255) ** 2.2,
  ];
}

export function createRandom(seed: number): () => number {
  let state = mixSeed(seed);
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

function mixSeed(seed: number): number {
  let hash = (seed >>> 0) ^ 0x9e3779b9;
  hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b);
  hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35);
  return (hash ^ (hash >>> 16)) >>> 0 || 1;
}

export function createFloraMesh(): FloraMeshData {
  return { positions: [], normals: [], colours: [], bend: [], foliage: [], glow: [] };
}

export function addTriangle(
  mesh: FloraMeshData,
  corners: readonly [Vec3, Vec3, Vec3],
  colour: Vec3,
  bend: readonly [number, number, number],
  { normals = null, foliage = false, glow = 0 }: TriangleOptions = {},
): void {
  const faceCross = cross(subtract(corners[1], corners[0]), subtract(corners[2], corners[0]));
  const faceArea = length(faceCross);
  if (faceArea <= DEGENERATE_TRIANGLE_EPSILON) return;
  const flat = scale(faceCross, 1 / faceArea);
  for (let index = 0; index < 3; index++) {
    const corner = corners[index];
    const normal = normals ? normals[index] : flat;
    mesh.positions.push(corner[0], corner[1], corner[2]);
    mesh.normals.push(normal[0], normal[1], normal[2]);
    mesh.colours.push(colour[0], colour[1], colour[2]);
    mesh.bend.push(bend[index]);
    mesh.foliage.push(foliage ? 1 : 0);
    mesh.glow.push(glow);
  }
}

export function addFrustum(
  mesh: FloraMeshData,
  {
    from,
    to,
    fromRadius,
    toRadius,
    sides,
    colour,
    rng,
    twist = 0,
    jag = 0,
    bend = () => 0,
    foliage = false,
    glow = 0,
  }: FrustumOptions,
): void {
  const axis = subtract(to, from);
  const [u, v] = perpendiculars(axis);
  const ring = (centre: Vec3, radius: number, offset: number, jagged: boolean): Vec3[] =>
    Array.from({ length: sides }, (_, side) => {
      const angle = ((side + offset) / sides) * Math.PI * 2;
      const reach = radius * (jagged && side % 2 === 1 ? 1 - jag : 1);
      return add(centre, add(scale(u, Math.cos(angle) * reach), scale(v, Math.sin(angle) * reach)));
    });
  const bottom = ring(from, fromRadius, 0, true);
  const top = ring(to, toRadius, twist, false);
  const weights = (corners: readonly [Vec3, Vec3, Vec3]): readonly [number, number, number] => [
    bend(corners[0]),
    bend(corners[1]),
    bend(corners[2]),
  ];
  for (let side = 0; side < sides; side++) {
    const next = (side + 1) % sides;
    const shade = shadeColour(colour, rng, 0.08);
    const faces: readonly (readonly [Vec3, Vec3, Vec3])[] = [
      [bottom[side], bottom[next], top[next]],
      [bottom[side], top[next], top[side]],
      [top[side], top[next], to],
    ];
    for (const face of faces) addTriangle(mesh, face, shade, weights(face), { foliage, glow });
  }
}

export function addSkirt(
  mesh: FloraMeshData,
  { centre, innerRadius, outerRadius, top, bottom, sides, notch, rng, light, dark, under, bend }: SkirtOptions,
): void {
  const turn = rng() * Math.PI * 2;
  const inner: Vec3[] = [];
  const outer: Vec3[] = [];
  for (let side = 0; side < sides; side++) {
    const angle = turn + ((side + (rng() - 0.5) * 0.35) / sides) * Math.PI * 2;
    const tooth = side % 2 === 1;
    const reach = outerRadius * (tooth ? 1 - notch : 1) * (0.88 + rng() * 0.24);
    const droop = (tooth ? 0.5 : 0) * (top - bottom) + (rng() - 0.5) * 0.2 * (top - bottom);
    inner.push([centre[0] + Math.cos(angle) * innerRadius, top, centre[2] + Math.sin(angle) * innerRadius]);
    outer.push([centre[0] + Math.cos(angle) * reach, bottom + droop, centre[2] + Math.sin(angle) * reach]);
  }
  const belly: Vec3 = [centre[0], bottom + (top - bottom) * 0.55, centre[2]];
  for (let side = 0; side < sides; side++) {
    const next = (side + 1) % sides;
    const rim: readonly [Vec3, Vec3, Vec3] = [inner[side], outer[next], outer[side]];
    const heart: readonly [Vec3, Vec3, Vec3] = [inner[side], inner[next], outer[next]];
    const shadow: readonly [Vec3, Vec3, Vec3] = [outer[side], outer[next], belly];
    addTriangle(mesh, rim, shadeColour(light, rng, 0.07), [bend(rim[0]), bend(rim[1]), bend(rim[2])], {
      foliage: true,
    });
    addTriangle(mesh, heart, shadeColour(dark, rng, 0.07), [bend(heart[0]), bend(heart[1]), bend(heart[2])], {
      foliage: true,
    });
    addTriangle(mesh, shadow, shadeColour(under, rng, 0.05), [bend(shadow[0]), bend(shadow[1]), bend(shadow[2])], {
      foliage: true,
    });
  }
}

export function addFrond(
  mesh: FloraMeshData,
  {
    base: crown,
    angle,
    length: spanLength,
    width,
    rng,
    light,
    dark,
    steps,
    lift,
    droop = 0.55,
    floor = -Infinity,
    rise = 0,
    glow = 0,
  }: FrondOptions,
): void {
  const out: Vec3 = [Math.cos(angle), 0, Math.sin(angle)];
  const side: Vec3 = [-Math.sin(angle), 0, Math.cos(angle)];
  const spine: Vec3[] = Array.from({ length: steps + 1 }, (_, step) => {
    const t = step / steps;
    const offset = spanLength * (lift * t - (lift + droop) * t * t);
    return [crown[0] + out[0] * spanLength * t, Math.max(floor, crown[1] + offset), crown[2] + out[2] * spanLength * t];
  });
  const edge = (step: number, sign: number): Vec3 => {
    const t = step / steps;
    const span = width * Math.sin(Math.PI * Math.min(1, t * 1.15)) * (step % 2 === 1 ? 0.65 : 1);
    const point = spine[step];
    return [
      point[0] + side[0] * span * sign,
      Math.max(floor, point[1] - span * 0.35),
      point[2] + side[2] * span * sign,
    ];
  };
  for (let step = 0; step < steps; step++) {
    const bend: readonly [number, number] = [step / steps, (step + 1) / steps];
    for (const sign of [1, -1] as const) {
      const a = spine[step];
      const b = spine[step + 1];
      const c = edge(step + 1, sign);
      const d = edge(step, sign);
      const faces: readonly (readonly [Vec3, Vec3, Vec3])[] =
        sign === 1
          ? [
              [a, c, b],
              [a, d, c],
            ]
          : [
              [a, b, c],
              [a, c, d],
            ];
      const sourceColour = sign === 1 ? light : dark;
      const shade: Vec3 = [
        sourceColour[0] * (0.94 + rng() * 0.12),
        sourceColour[1] * (0.94 + rng() * 0.12),
        sourceColour[2] * (0.94 + rng() * 0.12),
      ];
      for (const face of faces) {
        const w = (corner: Vec3): number =>
          (corner === a || corner === d ? bend[0] : bend[1]) * riseFromGround(corner[1], rise);
        addTriangle(mesh, face, shade, [w(face[0]), w(face[1]), w(face[2])], { foliage: true, glow });
      }
    }
  }
}

export function addLump(
  mesh: FloraMeshData,
  lump: LumpSpec,
  {
    rng,
    roughness,
    light,
    dark,
    attach = null,
    reach = 1,
    rise = 0,
    neighbours = [],
    flat = false,
    foliage = true,
    glow = 0,
  }: LumpOptions,
): void {
  const { centre, radius, squash = 1, coarse = false } = lump;
  const sphere = coarse ? COARSE_SPHERE : GEODESIC;
  const vertices: Vec3[] = sphere.vertices.map((point) => {
    const swell = 1 + (rng() * 2 - 1) * roughness;
    return add(centre, [point[0] * radius * swell, point[1] * radius * swell * squash, point[2] * radius * swell]);
  });
  const normals: Vec3[] = sphere.vertices.map((point) => normalise([point[0], point[1] / squash, point[2]]));
  const lowest = centre[1] - radius * squash;
  const span = radius * squash * 2;
  for (const face of sphere.faces) {
    const corners: readonly [Vec3, Vec3, Vec3] = [vertices[face[0]], vertices[face[1]], vertices[face[2]]];
    const middle = scale(add(add(corners[0], corners[1]), corners[2]), 1 / 3);
    if (neighbours.some((other) => isInsideLump(middle, other))) continue;
    if ((normals[face[0]][1] + normals[face[1]][1] + normals[face[2]][1]) / 3 < HIDDEN_FROM_MAP_CAMERA) continue;
    const tone = Math.min(1, Math.max(0, (middle[1] - lowest) / span));
    const colour = shadeColour(mixColour(dark, light, tone ** 0.8), rng, 0.05);
    const weight = (corner: Vec3): number =>
      attach ? Math.min(1, length(subtract(corner, attach)) / reach) * riseFromGround(corner[1], rise) : 0;
    addTriangle(mesh, corners, colour, [weight(corners[0]), weight(corners[1]), weight(corners[2])], {
      normals: flat ? null : [normals[face[0]], normals[face[1]], normals[face[2]]],
      foliage,
      glow,
    });
  }
}

function riseFromGround(height: number, rise: number): number {
  return rise > 0 ? Math.min(1, Math.max(0, height / rise - 0.15)) : 1;
}

function isInsideLump(point: Vec3, { centre, radius, squash = 1 }: LumpSpec): boolean {
  const [dx, dy, dz] = subtract(point, centre);
  return Math.hypot(dx, dy / squash, dz) < radius * 0.78;
}

function mixColour(a: Vec3, b: Vec3, t: number): Vec3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function shadeColour(colour: Vec3, rng: () => number, spread: number): Vec3 {
  const factor = 1 + (rng() * 2 - 1) * spread;
  return [Math.min(1, colour[0] * factor), Math.min(1, colour[1] * factor), Math.min(1, colour[2] * factor)];
}

const GEODESIC = buildGeodesic();
const COARSE_SPHERE = buildCoarseSphere();

function buildCoarseSphere(): SubdividedSphere {
  const vertices: Vec3[] = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ];
  const octahedron: readonly (readonly [number, number, number])[] = [
    [2, 4, 0],
    [2, 1, 4],
    [2, 5, 1],
    [2, 0, 5],
    [3, 0, 4],
    [3, 4, 1],
    [3, 1, 5],
    [3, 5, 0],
  ];
  return subdivideOnSphere(vertices, octahedron);
}

function buildGeodesic(): SubdividedSphere {
  const t = (1 + Math.sqrt(5)) / 2;
  const vertices: Vec3[] = (
    [
      [-1, t, 0],
      [1, t, 0],
      [-1, -t, 0],
      [1, -t, 0],
      [0, -1, t],
      [0, 1, t],
      [0, -1, -t],
      [0, 1, -t],
      [t, 0, -1],
      [t, 0, 1],
      [-t, 0, -1],
      [-t, 0, 1],
    ] as const
  ).map(normalise);
  const icosahedron: readonly (readonly [number, number, number])[] = [
    [0, 11, 5],
    [0, 5, 1],
    [0, 1, 7],
    [0, 7, 10],
    [0, 10, 11],
    [1, 5, 9],
    [5, 11, 4],
    [11, 10, 2],
    [10, 7, 6],
    [7, 1, 8],
    [3, 9, 4],
    [3, 4, 2],
    [3, 2, 6],
    [3, 6, 8],
    [3, 8, 9],
    [4, 9, 5],
    [2, 4, 11],
    [6, 2, 10],
    [8, 6, 7],
    [9, 8, 1],
  ];
  return subdivideOnSphere(vertices, icosahedron);
}

function subdivideOnSphere(
  corners: readonly Vec3[],
  triangles: readonly (readonly [number, number, number])[],
): SubdividedSphere {
  const vertices: Vec3[] = corners.map(normalise);
  const midpoints = new Map<string, number>();
  const midpoint = (a: number, b: number): number => {
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    const existing = midpoints.get(key);
    if (existing !== undefined) return existing;
    const created = vertices.length;
    midpoints.set(key, created);
    vertices.push(normalise(scale(add(vertices[a], vertices[b]), 0.5)));
    return created;
  };
  const faces: (readonly [number, number, number])[] = triangles.flatMap(([a, b, c]) => {
    const ab = midpoint(a, b);
    const bc = midpoint(b, c);
    const ca = midpoint(c, a);
    return [[a, ab, ca] as const, [b, bc, ab] as const, [c, ca, bc] as const, [ab, bc, ca] as const];
  });
  return { vertices, faces };
}

function perpendiculars(axis: Vec3): readonly [Vec3, Vec3] {
  const direction = normalise(axis);
  const helper: Vec3 = Math.abs(direction[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const u = normalise(cross(direction, helper));
  return [u, cross(direction, u)];
}

function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function subtract(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function scale(a: Vec3, factor: number): Vec3 {
  return [a[0] * factor, a[1] * factor, a[2] * factor];
}

function length(a: Vec3): number {
  return Math.hypot(a[0], a[1], a[2]);
}

function normalise(a: Vec3): Vec3 {
  return scale(a, 1 / length(a));
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
