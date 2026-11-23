const HIDDEN_FROM_MAP_CAMERA = -0.7;

export function createRandom(seed) {
  let state = mixSeed(seed);
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

function mixSeed(seed) {
  let hash = (seed >>> 0) ^ 0x9e3779b9;
  hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b);
  hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35);
  return (hash ^ (hash >>> 16)) >>> 0 || 1;
}

export function createFloraMesh() {
  return { positions: [], normals: [], colours: [], bend: [], foliage: [], glow: [] };
}

export function addTriangle(mesh, corners, colour, bend, { normals = null, foliage = false, glow = 0 } = {}) {
  const flat = normalise(cross(subtract(corners[1], corners[0]), subtract(corners[2], corners[0])));
  for (const [index, corner] of corners.entries()) {
    mesh.positions.push(...corner);
    mesh.normals.push(...(normals ? normals[index] : flat));
    mesh.colours.push(...colour);
    mesh.bend.push(bend[index]);
    mesh.foliage.push(foliage ? 1 : 0);
    mesh.glow.push(glow);
  }
}

export function addFrustum(
  mesh,
  { from, to, fromRadius, toRadius, sides, colour, rng, twist = 0, jag = 0, bend = () => 0, foliage = false, glow = 0 },
) {
  const axis = subtract(to, from);
  const [u, v] = perpendiculars(axis);
  const ring = (centre, radius, offset, jagged) =>
    Array.from({ length: sides }, (_, side) => {
      const angle = ((side + offset) / sides) * Math.PI * 2;
      const reach = radius * (jagged && side % 2 === 1 ? 1 - jag : 1);
      return add(centre, add(scale(u, Math.cos(angle) * reach), scale(v, Math.sin(angle) * reach)));
    });
  const bottom = ring(from, fromRadius, 0, true);
  const top = ring(to, toRadius, twist, false);
  const weights = (corners) => corners.map(bend);
  for (let side = 0; side < sides; side++) {
    const next = (side + 1) % sides;
    const shade = shadeColour(colour, rng, 0.08);
    const faces = [
      [bottom[side], bottom[next], top[next]],
      [bottom[side], top[next], top[side]],
      [top[side], top[next], to],
    ];
    for (const face of faces) addTriangle(mesh, face, shade, weights(face), { foliage, glow });
  }
}

export function addSkirt(
  mesh,
  { centre, innerRadius, outerRadius, top, bottom, sides, notch, rng, light, dark, under, bend },
) {
  const turn = rng() * Math.PI * 2;
  const inner = [];
  const outer = [];
  for (let side = 0; side < sides; side++) {
    const angle = turn + ((side + (rng() - 0.5) * 0.35) / sides) * Math.PI * 2;
    const tooth = side % 2 === 1;
    const reach = outerRadius * (tooth ? 1 - notch : 1) * (0.88 + rng() * 0.24);
    const droop = (tooth ? 0.5 : 0) * (top - bottom) + (rng() - 0.5) * 0.2 * (top - bottom);
    inner.push([centre[0] + Math.cos(angle) * innerRadius, top, centre[2] + Math.sin(angle) * innerRadius]);
    outer.push([centre[0] + Math.cos(angle) * reach, bottom + droop, centre[2] + Math.sin(angle) * reach]);
  }
  const belly = [centre[0], bottom + (top - bottom) * 0.55, centre[2]];
  for (let side = 0; side < sides; side++) {
    const next = (side + 1) % sides;
    const rim = [inner[side], outer[next], outer[side]];
    const heart = [inner[side], inner[next], outer[next]];
    addTriangle(mesh, rim, shadeColour(light, rng, 0.07), rim.map(bend), { foliage: true });
    addTriangle(mesh, heart, shadeColour(dark, rng, 0.07), heart.map(bend), { foliage: true });
    const shadow = [outer[side], outer[next], belly];
    addTriangle(mesh, shadow, shadeColour(under, rng, 0.05), shadow.map(bend), { foliage: true });
  }
}

export function addFrond(
  mesh,
  {
    base: crown,
    angle,
    length,
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
  },
) {
  const out = [Math.cos(angle), 0, Math.sin(angle)];
  const side = [-Math.sin(angle), 0, Math.cos(angle)];
  const spine = Array.from({ length: steps + 1 }, (_, step) => {
    const t = step / steps;
    const rise = length * (lift * t - (lift + droop) * t * t);
    return [crown[0] + out[0] * length * t, Math.max(floor, crown[1] + rise), crown[2] + out[2] * length * t];
  });
  const edge = (step, sign) => {
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
    const bend = [step / steps, (step + 1) / steps];
    for (const sign of [1, -1]) {
      const [a, b] = [spine[step], spine[step + 1]];
      const [c, d] = [edge(step + 1, sign), edge(step, sign)];
      const faces =
        sign === 1
          ? [
              [a, c, b],
              [a, d, c],
            ]
          : [
              [a, b, c],
              [a, c, d],
            ];
      const shade = (sign === 1 ? light : dark).map((channel) => channel * (0.94 + rng() * 0.12));
      for (const face of faces) {
        const weights = face.map(
          (corner) => (corner === a || corner === d ? bend[0] : bend[1]) * riseFromGround(corner[1], rise),
        );
        addTriangle(mesh, face, shade, weights, { foliage: true, glow });
      }
    }
  }
}

export function addLump(
  mesh,
  lump,
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
  },
) {
  const { centre, radius, squash = 1, coarse = false } = lump;
  const sphere = coarse ? COARSE_SPHERE : GEODESIC;
  const vertices = sphere.vertices.map((point) => {
    const swell = 1 + (rng() * 2 - 1) * roughness;
    return add(centre, [point[0] * radius * swell, point[1] * radius * swell * squash, point[2] * radius * swell]);
  });
  const normals = sphere.vertices.map((point) => normalise([point[0], point[1] / squash, point[2]]));
  const lowest = centre[1] - radius * squash;
  const span = radius * squash * 2;
  for (const face of sphere.faces) {
    const corners = face.map((index) => vertices[index]);
    const middle = scale(corners.reduce(add), 1 / 3);
    if (neighbours.some((other) => isInsideLump(middle, other))) continue;
    if (face.reduce((total, index) => total + normals[index][1], 0) / 3 < HIDDEN_FROM_MAP_CAMERA) continue;
    const tone = Math.min(1, Math.max(0, (middle[1] - lowest) / span));
    const colour = shadeColour(mixColour(dark, light, tone ** 0.8), rng, 0.05);
    const bend = corners.map((corner) =>
      attach ? Math.min(1, length(subtract(corner, attach)) / reach) * riseFromGround(corner[1], rise) : 0,
    );
    addTriangle(mesh, corners, colour, bend, {
      normals: flat ? null : face.map((index) => normals[index]),
      foliage,
      glow,
    });
  }
}

function riseFromGround(height, rise) {
  return rise > 0 ? Math.min(1, Math.max(0, height / rise - 0.15)) : 1;
}

function isInsideLump(point, { centre, radius, squash = 1 }) {
  const [dx, dy, dz] = subtract(point, centre);
  return Math.hypot(dx, dy / squash, dz) < radius * 0.78;
}

function mixColour(a, b, t) {
  return a.map((channel, index) => channel + (b[index] - channel) * t);
}

function shadeColour(colour, rng, spread) {
  const factor = 1 + (rng() * 2 - 1) * spread;
  return colour.map((channel) => Math.min(1, channel * factor));
}

const GEODESIC = buildGeodesic();
const COARSE_SPHERE = buildCoarseSphere();

function buildCoarseSphere() {
  const vertices = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ];
  const octahedron = [
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

function buildGeodesic() {
  const t = (1 + Math.sqrt(5)) / 2;
  const vertices = [
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
  ].map(normalise);
  const icosahedron = [
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

function subdivideOnSphere(corners, triangles) {
  const vertices = corners.map(normalise);
  const midpoints = new Map();
  const midpoint = (a, b) => {
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    if (!midpoints.has(key)) {
      midpoints.set(key, vertices.length);
      vertices.push(normalise(scale(add(vertices[a], vertices[b]), 0.5)));
    }
    return midpoints.get(key);
  };
  const faces = triangles.flatMap(([a, b, c]) => {
    const [ab, bc, ca] = [midpoint(a, b), midpoint(b, c), midpoint(c, a)];
    return [
      [a, ab, ca],
      [b, bc, ab],
      [c, ca, bc],
      [ab, bc, ca],
    ];
  });
  return { vertices, faces };
}

function perpendiculars(axis) {
  const direction = normalise(axis);
  const helper = Math.abs(direction[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const u = normalise(cross(direction, helper));
  return [u, cross(direction, u)];
}

function add(a, b) {
  return a.map((value, index) => value + b[index]);
}

function subtract(a, b) {
  return a.map((value, index) => value - b[index]);
}

function scale(a, factor) {
  return a.map((value) => value * factor);
}

function length(a) {
  return Math.hypot(...a);
}

function normalise(a) {
  return scale(a, 1 / length(a));
}

function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
