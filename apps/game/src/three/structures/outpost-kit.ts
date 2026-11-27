import {
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
} from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { mergeGeometries, mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { createProcgenMasonryMaterial } from "./procgen-masonry-material";

const OUTPOST_KIT_PREFIX = "procedural:outpost:";

const OUTPOST_BUILDERS = {
  village: buildVillage,
  camp: buildCamp,
  "cleared-standard": buildClearedStandard,
} as const satisfies Record<string, (parts: OutpostParts) => void>;

type OutpostKind = keyof typeof OUTPOST_BUILDERS;

export const OUTPOST_PATHS = {
  village: `${OUTPOST_KIT_PREFIX}village`,
  camp: `${OUTPOST_KIT_PREFIX}camp`,
  "cleared-standard": `${OUTPOST_KIT_PREFIX}cleared-standard`,
} as const satisfies Record<OutpostKind, string>;

const PALETTE = {
  limewash: "#dcd7c9",
  limewashShade: "#c8c2b2",
  canvas: "#dbd5c6",
  canvasShadow: "#beb6a3",
  canvasInside: "#9a9280",
  thatch: "#86765b",
  thatchRidge: "#78684e",
  oak: "#5a3e28",
  oakDark: "#432d1c",
  oakLight: "#6f5035",
  stone: "#7a7d7d",
  stoneDark: "#5e6263",
  interior: "#241d18",
  iron: "#3d4248",
  bronze: "#c99a3e",
  sunGold: "#d4a442",
  ember: "#cc4216",
  emberBright: "#d86420",
  defaultCloth: "#aa3028",
} as const;

interface OutpostPart {
  readonly geometry: BufferGeometry;
  readonly color: string;
  readonly smooth?: boolean;
}

interface OutpostParts {
  readonly body: OutpostPart[];
  readonly cloth: BufferGeometry[];
}

export function parseOutpostKitPath(path: string): OutpostKind | null {
  if (!path.startsWith(OUTPOST_KIT_PREFIX)) return null;
  const kind = path.slice(OUTPOST_KIT_PREFIX.length);
  return Object.hasOwn(OUTPOST_BUILDERS, kind) ? (kind as OutpostKind) : null;
}

export function isProceduralOutpostKitPath(path: string): boolean {
  return parseOutpostKitPath(path) !== null;
}

function createOutpostKit(kind: OutpostKind): GLTF {
  const parts: OutpostParts = { body: [], cloth: [] };
  OUTPOST_BUILDERS[kind](parts);
  return assembleOutpostGltf(kind, parts);
}

export function resolveProceduralOutpostKit(path: string): GLTF | null {
  const kind = parseOutpostKitPath(path);
  return kind ? createOutpostKit(kind) : null;
}

function assembleOutpostGltf(kind: OutpostKind, parts: OutpostParts): GLTF {
  const scene = new Group();
  scene.name = `outpost-${kind}`;

  const bodyGeometry = combineBodyParts(parts.body);
  const clothGeometry = combineClothParts(parts.cloth);
  const minY = Math.min(minGeometryY(bodyGeometry), minGeometryY(clothGeometry));
  if (minY !== 0) {
    bodyGeometry.translate(0, -minY, 0);
    clothGeometry.translate(0, -minY, 0);
  }

  const bodyMesh = new Mesh(bodyGeometry, createProcgenMasonryMaterial());
  bodyMesh.name = `${scene.name}:body`;
  scene.add(bodyMesh);

  const clothMaterial = new MeshStandardMaterial({
    color: PALETTE.defaultCloth,
    roughness: 0.88,
    metalness: 0,
    side: DoubleSide,
  });
  clothMaterial.name = "Ownership cloth";
  const clothMesh = new Mesh(clothGeometry, clothMaterial);
  clothMesh.name = `${scene.name}:cloth`;
  clothMesh.userData.relationshipCloth = "trim";
  scene.add(clothMesh);

  return {
    animations: [],
    scene,
    scenes: [scene],
    cameras: [],
    asset: {},
    parser: {} as GLTF["parser"],
    userData: {},
  };
}

function minGeometryY(geometry: BufferGeometry): number {
  geometry.computeBoundingBox();
  return geometry.boundingBox ? geometry.boundingBox.min.y : 0;
}

function preparePartGeometry(geometry: BufferGeometry, smooth: boolean): BufferGeometry {
  const prepared = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  if (!smooth) prepared.computeVertexNormals();
  else if (!prepared.getAttribute("normal")) prepared.computeVertexNormals();
  prepared.deleteAttribute("uv");
  return prepared;
}

function combineBodyParts(parts: readonly OutpostPart[]): BufferGeometry {
  const geometries = parts.map(({ geometry, color, smooth = false }, index) => {
    const prepared = preparePartGeometry(geometry, smooth);
    const tint = new Color(color);
    if (color !== PALETTE.interior && color !== PALETTE.ember && color !== PALETTE.emberBright) {
      tint.offsetHSL(0, 0, Math.sin(index * 19.37) * 0.022);
    }
    const normal = prepared.getAttribute("normal");
    const faceTint = new Color();
    const colors = new Float32Array(normal.count * 3);
    for (let vertex = 0; vertex < normal.count; vertex++) {
      const wear = color === PALETTE.interior ? 0 : Math.max(0, normal.getY(vertex)) * 0.024;
      faceTint
        .copy(tint)
        .offsetHSL(0, 0, wear)
        .toArray(colors, vertex * 3);
    }
    prepared.setAttribute("color", new Float32BufferAttribute(colors, 3));
    return prepared;
  });
  const merged = mergeGeometries(geometries)!;
  for (const geometry of geometries) geometry.dispose();
  for (const part of parts) part.geometry.dispose();
  const indexed = mergeVertices(merged, 1e-6);
  merged.dispose();
  return indexed;
}

function combineClothParts(parts: readonly BufferGeometry[]): BufferGeometry {
  const prepared = parts.map((geometry) => {
    const next = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    if (!next.getAttribute("normal")) next.computeVertexNormals();
    next.deleteAttribute("uv");
    return next;
  });
  const merged = mergeGeometries(prepared)!;
  for (const geometry of prepared) geometry.dispose();
  for (const geometry of parts) geometry.dispose();
  const indexed = mergeVertices(merged, 1e-6);
  merged.dispose();
  return indexed;
}

function addBox(
  target: OutpostPart[],
  width: number,
  height: number,
  depth: number,
  x: number,
  y: number,
  z: number,
  color: string,
  yaw = 0,
): void {
  const geometry = new BoxGeometry(width, height, depth);
  if (yaw !== 0) geometry.rotateY(yaw);
  geometry.translate(x, y, z);
  target.push({ geometry, color });
}

function addCylinder(
  target: OutpostPart[],
  radiusTop: number,
  radiusBottom: number,
  height: number,
  segments: number,
  x: number,
  y: number,
  z: number,
  color: string,
  smooth = false,
  yaw = 0,
): void {
  const geometry = new CylinderGeometry(radiusTop, radiusBottom, height, segments);
  if (yaw !== 0) geometry.rotateY(yaw);
  geometry.translate(x, y, z);
  target.push({ geometry, color, smooth });
}

function addTimber(
  target: OutpostPart[],
  start: readonly [number, number, number],
  end: readonly [number, number, number],
  radius: number,
  color: string = PALETTE.oak,
  segments = 6,
): void {
  const a = new Vector3(start[0], start[1], start[2]);
  const b = new Vector3(end[0], end[1], end[2]);
  const delta = b.clone().sub(a);
  const length = delta.length();
  if (length < 1e-4) return;
  const geometry = new CylinderGeometry(radius, radius, length, segments);
  const rotation = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), delta.normalize());
  geometry.applyQuaternion(rotation);
  geometry.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  target.push({ geometry, color });
}

function buildQuadGrid(
  rows: number,
  cols: number,
  sample: (row: number, col: number) => readonly [number, number, number],
  flip = false,
): BufferGeometry {
  const positions: number[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const [x, y, z] = sample(row, col);
      positions.push(x, y, z);
    }
  }
  const indices: number[] = [];
  for (let row = 0; row < rows - 1; row++) {
    for (let col = 0; col < cols - 1; col++) {
      const a = row * cols + col;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      if (flip) {
        indices.push(a, c, b, b, c, d);
      } else {
        indices.push(a, b, c, b, d, c);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function buildTriangleGeometry(points: readonly (readonly [number, number, number])[]): BufferGeometry {
  const positions = new Float32Array(points.length * 3);
  for (let i = 0; i < points.length; i++) {
    positions[i * 3] = points[i][0];
    positions[i * 3 + 1] = points[i][1];
    positions[i * 3 + 2] = points[i][2];
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function buildQuadStrip(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  c: readonly [number, number, number],
  d: readonly [number, number, number],
): BufferGeometry {
  return buildTriangleGeometry([a, b, c, a, c, d]);
}

function addBarrel(target: OutpostPart[], x: number, z: number, height = 0.13, radius = 0.044): void {
  addCylinder(target, radius * 0.86, radius, height * 0.5, 10, x, height * 0.75, z, PALETTE.oakLight, true);
  addCylinder(target, radius, radius * 0.86, height * 0.5, 10, x, height * 0.25, z, PALETTE.oakLight, true);
  for (const bandY of [height * 0.24, height * 0.76]) {
    addCylinder(target, radius * 1.03, radius * 1.03, height * 0.09, 10, x, bandY, z, PALETTE.iron, true);
  }
}

function addSupplyChest(
  target: OutpostPart[],
  x: number,
  z: number,
  width: number,
  height: number,
  depth: number,
  yaw = 0,
): void {
  addBox(target, width, height * 0.72, depth, x, height * 0.36, z, PALETTE.oak, yaw);
  addBox(target, width * 1.03, height * 0.28, depth * 1.03, x, height * 0.86, z, PALETTE.oakLight, yaw);
  for (const offset of [-width * 0.34, width * 0.34]) {
    const ox = Math.cos(yaw) * offset;
    const oz = -Math.sin(yaw) * offset;
    addBox(target, 0.018, height * 1.02, depth * 1.05, x + ox, height * 0.51, z + oz, PALETTE.iron, yaw);
  }
  const frontX = Math.sin(yaw) * (depth * 0.53);
  const frontZ = Math.cos(yaw) * (depth * 0.53);
  addBox(target, 0.028, 0.026, 0.012, x + frontX, height * 0.68, z + frontZ, PALETTE.bronze, yaw);
}

function addPointedStake(target: OutpostPart[], x: number, z: number, height: number, radius: number): void {
  const shaft = height * 0.82;
  const tip = height - shaft;
  addCylinder(target, radius, radius * 1.08, shaft, 6, x, shaft / 2, z, PALETTE.oak);
  addCylinder(target, 0.002, radius, tip, 6, x, shaft + tip / 2, z, PALETTE.oakLight);
}

function addStandardEmblem(
  target: OutpostPart[],
  centerX: number,
  centerY: number,
  centerZ: number,
  radius: number,
  zOffset: number,
): void {
  for (const side of [-1, 1]) {
    const z = centerZ + side * zOffset;
    const disc = new CylinderGeometry(radius * 0.32, radius * 0.32, 0.006, 8);
    disc.rotateX(Math.PI / 2);
    disc.translate(centerX, centerY, z);
    target.push({ geometry: disc, color: PALETTE.sunGold });
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI * 2) / 8;
      const sx = centerX + Math.sin(angle) * radius * 0.58;
      const sy = centerY + Math.cos(angle) * radius * 0.58;
      const ray = new BoxGeometry(radius * 0.14, radius * 0.54, 0.005);
      ray.rotateZ(-angle);
      ray.translate(sx, sy, z);
      target.push({ geometry: ray, color: PALETTE.sunGold });
    }
  }
}

function addStandardBanner(
  parts: OutpostParts,
  poleX: number,
  poleZ: number,
  poleHeight: number,
  barLength: number,
  clothWidth: number,
  clothHeight: number,
  waveDepth: number,
): void {
  addCylinder(parts.body, 0.015, 0.019, poleHeight, 8, poleX, poleHeight / 2, poleZ, PALETTE.oak, true);
  addCylinder(parts.body, 0.024, 0.028, 0.032, 8, poleX, 0.016, poleZ, PALETTE.bronze, true);
  addCylinder(parts.body, 0.022, 0.022, 0.02, 8, poleX, poleHeight * 0.52, poleZ, PALETTE.bronze, true);

  const barY = poleHeight - 0.055;
  addTimber(parts.body, [poleX - 0.022, barY, poleZ], [poleX + barLength, barY, poleZ], 0.01, PALETTE.bronze, 6);
  addCylinder(parts.body, 0.003, 0.022, 0.072, 6, poleX, poleHeight + 0.026, poleZ, PALETTE.bronze);
  addCylinder(parts.body, 0.014, 0.014, 0.02, 6, poleX + barLength, barY, poleZ, PALETTE.bronze);

  const clothTop = barY - 0.012;
  const clothStartX = poleX + 0.014;
  const pennant = buildQuadGrid(
    6,
    8,
    (row, col) => {
      const u = col / 7;
      const v = row / 5;
      const x = clothStartX + u * clothWidth;
      const swallowtail = row === 5 ? Math.sin(u * Math.PI) * 0.022 : 0;
      const y = clothTop - v * clothHeight + swallowtail;
      const z = poleZ + Math.sin(u * Math.PI * 1.45 + v * 0.5) * waveDepth * (0.3 + 0.7 * v);
      return [x, y, z];
    },
    true,
  );
  parts.cloth.push(pennant);

  const emblemX = clothStartX + clothWidth * 0.5;
  const emblemY = clothTop - clothHeight * 0.46;
  const emblemZ = poleZ + Math.sin(0.5 * Math.PI * 1.45 + 0.23) * waveDepth * 0.62;
  addStandardEmblem(parts.body, emblemX, emblemY, emblemZ, Math.min(clothWidth, clothHeight) * 0.27, 0.012);
}

function buildVillage(parts: OutpostParts): void {
  addVillageFence(parts);
  addVillageCottage(parts, -0.49, 0.22, 0.3, 0.32, 0.24, 0.18, 0);
  addVillageCottage(parts, 0.49, 0.22, 0.29, 0.31, 0.24, 0.18, 0);
  addVillageShelter(parts);
  addVillageTent(parts, 0.28, -0.27);
  addVillageHearth(parts, -0.01, 0.24);
  addStandardBanner(parts, 0.29, -0.5, 0.78, 0.21, 0.18, 0.21, 0.018);
}

function addVillageFence(parts: OutpostParts): void {
  const radius = 0.94;
  const corners: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI / 6 + (i * Math.PI) / 3;
    corners.push([radius * Math.cos(angle), radius * Math.sin(angle)]);
  }
  const posts: [number, number][] = [];
  for (let side = 0; side < 6; side++) {
    const [x0, z0] = corners[side];
    const [x1, z1] = corners[(side + 1) % 6];
    for (let step = 0; step < 3; step++) {
      posts.push([x0 + ((x1 - x0) * step) / 3, z0 + ((z1 - z0) * step) / 3]);
    }
  }
  const total = posts.length;
  for (let i = 0; i < total; i++) {
    const [x, z] = posts[i];
    const isFrontGap = z > 0.72 && Math.abs(x) < 0.2;
    if (isFrontGap) continue;
    const isGatePost = z > 0.56 && Math.abs(x) < 0.38;
    addPointedStake(parts.body, x, z, isGatePost ? 0.37 : 0.33, isGatePost ? 0.032 : 0.026);
    const [nx, nz] = posts[(i + 1) % total];
    const nextIsGap = nz > 0.72 && Math.abs(nx) < 0.2;
    if (nextIsGap) continue;
    addTimber(parts.body, [x, 0.11, z], [nx, 0.115, nz], 0.011, PALETTE.oakDark, 5);
    addTimber(parts.body, [x, 0.24, z], [nx, 0.245, nz], 0.011, PALETTE.oakDark, 5);
    for (const t of [0.25, 0.5, 0.75]) {
      const px = x + (nx - x) * t;
      const pz = z + (nz - z) * t;
      addPointedStake(parts.body, px, pz, 0.28, 0.017);
    }
  }
}

function addVillageCottage(
  parts: OutpostParts,
  cx: number,
  cz: number,
  width: number,
  depth: number,
  wallHeight: number,
  roofRise: number,
  yaw: number,
): void {
  const local: OutpostPart[] = [];
  const w = width / 2;
  const d = depth / 2;

  addBox(local, width + 0.02, 0.055, depth + 0.02, 0, 0.028, 0, PALETTE.stone);
  addBox(local, width, wallHeight - 0.04, depth, 0, 0.055 + (wallHeight - 0.04) / 2, 0, PALETTE.limewash);

  for (const zSide of [-1, 1]) {
    const z = zSide * d;
    const gable = buildTriangleGeometry(
      zSide > 0
        ? [
            [-w, wallHeight, z],
            [w, wallHeight, z],
            [0, wallHeight + roofRise - 0.015, z],
          ]
        : [
            [w, wallHeight, z],
            [-w, wallHeight, z],
            [0, wallHeight + roofRise - 0.015, z],
          ],
    );
    local.push({ geometry: gable, color: PALETTE.limewashShade });
    addTimber(local, [0, wallHeight - 0.01, z], [0, wallHeight + roofRise - 0.01, z], 0.013, PALETTE.oakDark, 5);
    addTimber(local, [-w, wallHeight - 0.018, z], [w, wallHeight - 0.018, z], 0.014, PALETTE.oakDark, 5);
    addTimber(local, [-w, 0.085, z], [w, 0.085, z], 0.013, PALETTE.oakDark, 5);
    for (const xSide of [-1, 1]) {
      addTimber(local, [xSide * (w - 0.01), 0.04, z], [xSide * (w - 0.01), wallHeight, z], 0.015, PALETTE.oak, 5);
      addTimber(
        local,
        [xSide * w * 0.78, wallHeight, z + zSide * 0.004],
        [0, wallHeight + roofRise * 0.62, z + zSide * 0.004],
        0.01,
        PALETTE.oakDark,
        5,
      );
    }
  }

  for (const xSide of [-1, 1]) {
    addTimber(
      local,
      [xSide * w, 0.09, -d + 0.015],
      [xSide * w, wallHeight - 0.02, d - 0.015],
      0.01,
      PALETTE.oakDark,
      5,
    );
  }

  const roofW = width * 0.62;
  const roofD = depth * 0.6;
  for (const side of [-1, 1]) {
    for (let course = 0; course < 3; course++) {
      const u0 = course / 3;
      const u1 = Math.min(1.04, (course + 1.18) / 3);
      const lift = (2 - course) * 0.006;
      const slab = buildQuadGrid(
        3,
        5,
        (r, c) => {
          const u = r === 0 ? u0 : r === 1 ? (u0 + u1) / 2 : u1;
          const t = c / 4;
          const z = -roofD + t * roofD * 2;
          const sag = 0.008 * Math.sin(t * Math.PI);
          const bow = 0.018 * Math.sin(u * Math.PI);
          const y = wallHeight + roofRise * (1 - u) - sag + bow + 0.014 + lift;
          return [side * roofW * u, y, z];
        },
        side < 0,
      );
      local.push({ geometry: slab, color: course === 0 ? PALETTE.thatchRidge : PALETTE.thatch });
      const eave = buildQuadGrid(
        2,
        5,
        (r, c) => {
          const t = c / 4;
          const z = -roofD + t * roofD * 2;
          const sag = 0.008 * Math.sin(t * Math.PI);
          const bow = 0.018 * Math.sin(u1 * Math.PI);
          const y = wallHeight + roofRise * (1 - u1) - sag + bow + 0.014 + lift - r * 0.022;
          return [side * roofW * u1, y, z];
        },
        side < 0,
      );
      local.push({ geometry: eave, color: PALETTE.thatchRidge });
    }
    for (const zVerge of [-roofD - 0.006, roofD + 0.006]) {
      addTimber(
        local,
        [side * roofW, wallHeight - 0.004, zVerge],
        [0, wallHeight + roofRise + 0.022, zVerge],
        0.012,
        PALETTE.oak,
        5,
      );
    }
  }
  addTimber(
    local,
    [0, wallHeight + roofRise + 0.025, -roofD],
    [0, wallHeight + roofRise + 0.025, roofD],
    0.024,
    PALETTE.thatchRidge,
    6,
  );

  const doorH = wallHeight * 0.78;
  addBox(local, 0.09, doorH, 0.02, 0, doorH / 2, d + 0.006, PALETTE.oakDark);
  addBox(local, 0.125, 0.024, 0.055, 0, 0.012, d + 0.032, PALETTE.stoneDark);
  addTimber(local, [-0.05, 0.02, d + 0.014], [-0.05, doorH, d + 0.014], 0.009, PALETTE.oak, 5);
  addTimber(local, [0.05, 0.02, d + 0.014], [0.05, doorH, d + 0.014], 0.009, PALETTE.oak, 5);
  addTimber(local, [-0.054, doorH, d + 0.014], [0.054, doorH, d + 0.014], 0.011, PALETTE.oak, 5);

  const winSide = cx < 0 ? 1 : -1;
  const winX = winSide * (w + 0.005);
  const winY = wallHeight * 0.62;
  addBox(local, 0.016, 0.072, 0.08, winX, winY, 0.02, PALETTE.emberBright);
  addBox(local, 0.022, 0.012, 0.095, winX, winY + 0.04, 0.02, PALETTE.oakDark);
  addBox(local, 0.022, 0.012, 0.095, winX, winY - 0.04, 0.02, PALETTE.oakDark);
  addBox(local, 0.022, 0.085, 0.01, winX, winY, 0.02, PALETTE.oakDark);

  for (const part of local) {
    if (yaw !== 0) part.geometry.rotateY(yaw);
    part.geometry.translate(cx, 0, cz);
    parts.body.push(part);
  }
}

function addVillageShelter(parts: OutpostParts): void {
  const x = -0.18;
  const zFront = -0.2;
  const width = 0.54;
  const depth = 0.28;
  const height = 0.45;
  const roof = buildQuadGrid(
    5,
    7,
    (row, col) => {
      const u = col / 6;
      const t = row / 4;
      const px = x + (u - 0.5) * width;
      const pz = zFront - t * depth;
      const sag = (0.042 + 0.022 * Math.sin(t * Math.PI)) * Math.sin(u * Math.PI);
      const py = height + 0.032 * t - sag;
      return [px, py, pz];
    },
    false,
  );
  parts.body.push({ geometry: roof, color: PALETTE.canvas, smooth: true });
  const underside = buildQuadGrid(
    5,
    7,
    (row, col) => {
      const u = col / 6;
      const t = row / 4;
      const px = x + (u - 0.5) * width;
      const pz = zFront - t * depth;
      const sag = (0.042 + 0.022 * Math.sin(t * Math.PI)) * Math.sin(u * Math.PI);
      const py = height + 0.032 * t - sag - 0.008;
      return [px, py, pz];
    },
    true,
  );
  parts.body.push({ geometry: underside, color: PALETTE.canvasShadow, smooth: true });

  for (const postX of [x - width / 2, x + width / 2]) {
    addTimber(parts.body, [postX, 0, zFront], [postX, height + 0.02, zFront], 0.015, PALETTE.oak, 6);
    addTimber(parts.body, [postX, 0, zFront - depth], [postX, height + 0.055, zFront - depth], 0.014, PALETTE.oak, 6);
    addTimber(parts.body, [postX, height, zFront], [postX, height + 0.035, zFront - depth], 0.009, PALETTE.oakDark, 5);
  }
  addSupplyChest(parts.body, x - 0.14, zFront - 0.14, 0.14, 0.09, 0.11, 0.12);
  addSupplyChest(parts.body, x + 0.08, zFront - 0.14, 0.13, 0.11, 0.1, -0.15);
  addBarrel(parts.body, x - 0.2, zFront - 0.04, 0.12, 0.038);
  addBarrel(parts.body, x + 0.19, zFront - 0.18, 0.12, 0.038);
}

function addVillageTent(parts: OutpostParts, cx: number, cz: number): void {
  const width = 0.31;
  const depth = 0.29;
  const peak = 0.34;
  for (const side of [-1, 1]) {
    const slope = buildQuadGrid(
      5,
      5,
      (row, col) => {
        const u = row / 4;
        const t = col / 4;
        const px = cx + side * width * 0.5 * u;
        const pz = cz + (t - 0.5) * depth;
        const py = peak * (1 - u) + 0.02 * u - 0.024 * Math.sin(t * Math.PI) * Math.sin(u * Math.PI);
        return [px, py, pz];
      },
      side < 0,
    );
    parts.body.push({ geometry: slope, color: PALETTE.canvas, smooth: true });

    const innerSlope = buildQuadGrid(
      3,
      3,
      (row, col) => {
        const u = row / 2;
        const t = col / 2;
        const px = cx + side * (width * 0.48) * u;
        const pz = cz + (t - 0.5) * depth;
        const py = (peak - 0.01) * (1 - u) + 0.015 * u;
        return [px, py, pz];
      },
      side > 0,
    );
    parts.body.push({ geometry: innerSlope, color: PALETTE.canvasInside, smooth: true });

    const strip = buildQuadStrip(
      [cx, peak + 0.006, cz + depth / 2 + 0.01],
      [cx + side * 0.02, peak - 0.012, cz + depth / 2 + 0.01],
      [cx + side * (width / 2 + 0.01), 0.025, cz + depth / 2 + 0.01],
      [cx + side * (width / 2 - 0.01), 0.025, cz + depth / 2 + 0.01],
    );
    parts.cloth.push(strip);
  }
  const back = buildTriangleGeometry([
    [cx + width * 0.48, 0.01, cz - depth / 2],
    [cx - width * 0.48, 0.01, cz - depth / 2],
    [cx, peak, cz - depth / 2],
  ]);
  parts.body.push({ geometry: back, color: PALETTE.canvasShadow });
  addTimber(parts.body, [cx, 0, cz - depth / 2], [cx, peak + 0.035, cz - depth / 2], 0.01, PALETTE.oak, 5);
  addTimber(parts.body, [cx, 0, cz + depth / 2], [cx, peak + 0.035, cz + depth / 2], 0.01, PALETTE.oak, 5);
  addTimber(parts.body, [cx, peak, cz - depth / 2 - 0.025], [cx, peak, cz + depth / 2 + 0.025], 0.01, PALETTE.oak, 5);
}

function addVillageHearth(parts: OutpostParts, cx: number, cz: number): void {
  for (let i = 0; i < 10; i++) {
    const angle = (i * Math.PI * 2) / 10;
    const stone = new SphereGeometry(0.032, 7, 5);
    stone.scale(1.05, 0.68, 0.92);
    stone.computeVertexNormals();
    stone.translate(cx + Math.cos(angle) * 0.1, 0.02, cz + Math.sin(angle) * 0.1);
    parts.body.push({ geometry: stone, color: i % 2 === 0 ? PALETTE.stone : PALETTE.stoneDark, smooth: true });
  }
  for (let i = 0; i < 3; i++) {
    const angle = (i * Math.PI) / 3 + 0.25;
    const dx = Math.cos(angle) * 0.055;
    const dz = Math.sin(angle) * 0.055;
    addTimber(parts.body, [cx - dx, 0.02, cz - dz], [cx + dx, 0.035, cz + dz], 0.014, PALETTE.oakDark, 5);
  }
  addCylinder(parts.body, 0.01, 0.052, 0.075, 5, cx, 0.055, cz, PALETTE.ember);
  addCylinder(parts.body, 0.004, 0.03, 0.095, 5, cx + 0.006, 0.075, cz - 0.005, PALETTE.emberBright);

  addBox(parts.body, 0.19, 0.02, 0.06, cx - 0.01, 0.055, cz + 0.21, PALETTE.oakLight, 0.06);
  addBox(parts.body, 0.024, 0.052, 0.05, cx - 0.08, 0.026, cz + 0.21, PALETTE.oak, 0.06);
  addBox(parts.body, 0.024, 0.052, 0.05, cx + 0.06, 0.026, cz + 0.21, PALETTE.oak, 0.06);

  for (const [sx, sz] of [
    [-0.17, 0.03],
    [0.16, 0.02],
    [0.14, 0.17],
  ]) {
    addCylinder(parts.body, 0.028, 0.032, 0.048, 7, cx + sx, 0.024, cz + sz, PALETTE.oakLight);
  }
  addBarrel(parts.body, -0.24, 0.04, 0.115, 0.036);
}

function buildCamp(parts: OutpostParts): void {
  addCampStockade(parts);
  addCampTent(parts, 0, -0.02, 0.74, 0.78, 0.86, 0.34, true);
  addCampTent(parts, -0.47, 0.22, 0.34, 0.42, 0.45, 0.16, false);
  addCampTent(parts, 0.47, 0.22, 0.34, 0.42, 0.45, 0.16, false);
  addSupplyChest(parts.body, 0.0, 0.42, 0.21, 0.16, 0.14, 0);
  addBarrel(parts.body, -0.34, 0.48, 0.15, 0.052);
  addBarrel(parts.body, 0.34, 0.48, 0.15, 0.052);
  addStandardBanner(parts, 0.15, 0.49, 1.0, 0.25, 0.22, 0.23, 0.02);
}

function addCampStockade(parts: OutpostParts): void {
  const stakeCount = 17;
  const radiusX = 0.72;
  const radiusZ = 0.68;
  const points: [number, number][] = [];
  for (let i = 0; i < stakeCount; i++) {
    const t = i / (stakeCount - 1);
    const angle = -Math.PI * 0.72 + t * Math.PI * 1.44;
    const x = Math.sin(angle) * radiusX;
    const z = -Math.cos(angle) * radiusZ - 0.02;
    points.push([x, z]);
    const height = 0.37 + (i % 3 === 0 ? 0.045 : i % 2 === 0 ? 0.018 : -0.012);
    addPointedStake(parts.body, x, z, height, 0.03);
  }
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, z0] = points[i];
    const [x1, z1] = points[i + 1];
    addTimber(parts.body, [x0, 0.12, z0], [x1, 0.12, z1], 0.013, PALETTE.oakDark, 5);
    addTimber(parts.body, [x0, 0.25, z0], [x1, 0.25, z1], 0.013, PALETTE.oakDark, 5);
  }
}

function addCampTent(
  parts: OutpostParts,
  cx: number,
  cz: number,
  width: number,
  depth: number,
  peak: number,
  eaveHeight: number,
  commandTent: boolean,
): void {
  const localBody: OutpostPart[] = [];
  const localCloth: BufferGeometry[] = [];
  const hw = width / 2;
  const hd = depth / 2;

  for (const side of [-1, 1]) {
    const roof = buildQuadGrid(
      5,
      6,
      (row, col) => {
        const u = row / 4;
        const t = col / 5;
        const x = side * hw * u;
        const z = -hd + t * depth;
        const sag = 0.026 * Math.sin(u * Math.PI) * Math.sin(t * Math.PI);
        const y = peak * (1 - u) + eaveHeight * u - sag;
        return [x, y, z];
      },
      side < 0,
    );
    localBody.push({ geometry: roof, color: PALETTE.canvas, smooth: true });

    const innerRoof = buildQuadGrid(
      3,
      4,
      (row, col) => {
        const u = row / 2;
        const t = col / 3;
        const x = side * (hw - 0.01) * u;
        const z = -hd + t * depth;
        const y = (peak - 0.012) * (1 - u) + (eaveHeight - 0.012) * u;
        return [x, y, z];
      },
      side > 0,
    );
    localBody.push({ geometry: innerRoof, color: PALETTE.canvasInside, smooth: true });

    const wall = buildQuadGrid(
      3,
      6,
      (row, col) => {
        const v = row / 2;
        const t = col / 5;
        const x = side * (hw + 0.025 * v);
        const z = -hd + t * depth;
        const y = eaveHeight * (1 - v);
        return [x, y, z];
      },
      side < 0,
    );
    localBody.push({ geometry: wall, color: PALETTE.canvasShadow, smooth: true });

    const innerWall = buildQuadGrid(
      2,
      3,
      (row, col) => {
        const v = row;
        const t = col / 2;
        const x = side * (hw - 0.01 + 0.02 * v);
        const z = -hd + t * depth;
        const y = eaveHeight * (1 - v);
        return [x, y, z];
      },
      side > 0,
    );
    localBody.push({ geometry: innerWall, color: PALETTE.canvasInside, smooth: true });

    const flapOuter = buildTriangleGeometry(
      side > 0
        ? [
            [0, peak, hd],
            [hw, eaveHeight, hd],
            [hw * 0.45, 0.01, hd + 0.02],
          ]
        : [
            [0, peak, hd],
            [-hw * 0.45, 0.01, hd + 0.02],
            [-hw, eaveHeight, hd],
          ],
    );
    localBody.push({ geometry: flapOuter, color: PALETTE.canvas });
    const flapLower = buildTriangleGeometry(
      side > 0
        ? [
            [hw, eaveHeight, hd],
            [hw + 0.02, 0.01, hd],
            [hw * 0.45, 0.01, hd + 0.02],
          ]
        : [
            [-hw, eaveHeight, hd],
            [-hw * 0.45, 0.01, hd + 0.02],
            [-hw - 0.02, 0.01, hd],
          ],
    );
    localBody.push({ geometry: flapLower, color: PALETTE.canvasShadow });

    const trimW = commandTent ? 0.032 : 0.024;
    const frontTrim = buildQuadStrip(
      [0, peak + 0.01, hd + 0.014],
      [side * trimW, peak - trimW * 0.72, hd + 0.014],
      [side * (hw + 0.01), eaveHeight, hd + 0.014],
      [side * (hw - trimW), eaveHeight, hd + 0.014],
    );
    localCloth.push(frontTrim);

    const eaveTrim = buildQuadStrip(
      [side * (hw + 0.008), eaveHeight + 0.012, -hd],
      [side * (hw + 0.008), eaveHeight + 0.012, hd],
      [side * (hw + 0.012), eaveHeight - 0.02, hd],
      [side * (hw + 0.012), eaveHeight - 0.02, -hd],
    );
    localCloth.push(eaveTrim);

    for (const zPost of [-hd, hd]) {
      addTimber(localBody, [side * hw, 0, zPost], [side * hw, eaveHeight + 0.025, zPost], 0.016, PALETTE.oak, 5);
    }
  }

  const backWall = buildTriangleGeometry([
    [hw, eaveHeight, -hd],
    [-hw, eaveHeight, -hd],
    [0, peak, -hd],
  ]);
  localBody.push({ geometry: backWall, color: PALETTE.canvasShadow });
  addBox(localBody, width, eaveHeight, 0.02, 0, eaveHeight / 2, -hd, PALETTE.canvasShadow);

  const ridgeRadius = commandTent ? 0.022 : 0.015;
  addTimber(localBody, [0, peak + 0.014, -hd - 0.045], [0, peak + 0.014, hd + 0.045], ridgeRadius, PALETTE.oak, 6);
  addTimber(localBody, [0, 0, -hd], [0, peak + 0.05, -hd], ridgeRadius, PALETTE.oak, 6);

  for (const part of localBody) {
    part.geometry.translate(cx, 0, cz);
    parts.body.push(part);
  }
  for (const cloth of localCloth) {
    cloth.translate(cx, 0, cz);
    parts.cloth.push(cloth);
  }
}

function buildClearedStandard(parts: OutpostParts): void {
  addStandardBanner(parts, -0.18, -0.58, 0.89, 0.27, 0.24, 0.22, 0.022);
}
