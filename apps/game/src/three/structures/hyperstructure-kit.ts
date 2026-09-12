import {
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DataTexture,
  Float32BufferAttribute,
  Group,
  Shape,
  ExtrudeGeometry,
  Quaternion,
  Vector3,
  SphereGeometry,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  OctahedronGeometry,
  RepeatWrapping,
  TorusGeometry,
} from "three";
import { mergeGeometries, mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import {
  HYPERSTRUCTURE_BASE_HEIGHT,
  HYPERSTRUCTURE_COURSES,
  HYPERSTRUCTURE_FAMILIES,
  type HyperstructureFamily,
} from "./hyperstructure-design";

const STONE = "#41494e";
const EDGE = "#646c70";
const GOLD = "#a68b55";
const DARK = "#1c252c";
type Part = { geometry: BufferGeometry; color: string };

/** Shared foundation, family masonry, and independent crown mechanisms. */
export function createHyperstructureKit(foundationOnly = false): Pick<GLTF, "scene" | "animations"> {
  const scene = new Group();
  const masonry = createMasonryMaterial(foundationOnly);
  addPart(scene, "base", foundation(), masonry);
  if (foundationOnly) return { scene, animations: [] };
  const { core, channels } = createPowerMaterials();
  for (const family of HYPERSTRUCTURE_FAMILIES) {
    for (let course = 0; course < HYPERSTRUCTURE_COURSES; course++) {
      addPart(scene, `course:${family}:${course}`, shaftCourse(family, course), masonry);
    }
  }
  addPart(scene, "collar", crownCollar(), masonry);
  addPart(scene, "prongs", crownProngs(), masonry);
  addPart(scene, "astrolabe", astrolabe(), masonry);
  addPart(scene, "astrolabe:outer", new TorusGeometry(0.34, 0.022, 5, 48), masonry);
  addPart(scene, "astrolabe:inner", new TorusGeometry(0.29, 0.016, 5, 48), masonry);
  addPart(scene, "petals", petals(), masonry);
  addPart(scene, "crystals", crystals(), masonry);
  addPart(scene, "crescent", crescent(), masonry);
  addPart(scene, "cage", cage(), masonry);
  addPart(scene, "spear", spear(), masonry);
  addPart(scene, "spear:satellite", new OctahedronGeometry(0.065), core);
  addPart(scene, "wings:left", wings(-1), masonry);
  addPart(scene, "wings:right", wings(1), masonry);
  addPart(scene, "core", new OctahedronGeometry(0.13, 0), core);
  addPart(scene, "orb", new IcosahedronGeometry(0.115, 1), core);
  addPart(scene, "channels", crownInlays(), channels);
  addPart(scene, "activation", new TorusGeometry(0.24, 0.009, 5, 48).rotateX(Math.PI / 2), core);
  return { scene, animations: [] };
}

function createMasonryMaterial(foundationOnly: boolean): MeshStandardMaterial {
  const grain = foundationOnly ? null : stoneGrain();
  return new MeshStandardMaterial({
    vertexColors: true,
    map: grain,
    bumpMap: grain,
    roughnessMap: grain,
    bumpScale: 0.006,
    roughness: 0.78,
    metalness: 0.16,
    flatShading: true,
  });
}

function createPowerMaterials() {
  const core = new MeshStandardMaterial({
    color: "#9361c7",
    emissive: "#7829cd",
    emissiveIntensity: 0.9,
    roughness: 0.22,
    metalness: 0.35,
    flatShading: true,
  });
  const channels = new MeshStandardMaterial({
    color: "#71c6bd",
    emissive: "#258d87",
    emissiveIntensity: 1.5,
    roughness: 0.4,
    metalness: 0.25,
  });
  return { core, channels };
}

function addPart(scene: Group, name: string, geometry: BufferGeometry, material: MeshStandardMaterial): void {
  const mesh = new Mesh(geometry, material);
  mesh.name = name;
  mesh.userData.hyperstructurePart = name;
  scene.add(mesh);
}

function piece(geometry: BufferGeometry, color: string, x = 0, y = 0, z = 0, yaw = 0): Part {
  geometry.rotateY(yaw).translate(x, y, z);
  return { geometry, color };
}

function combine(parts: Part[]): BufferGeometry {
  const geometries = parts.map(({ geometry, color }, partIndex) => {
    const flat = geometry.index ? geometry.toNonIndexed() : geometry;
    const tint = new Color(color);
    if (color !== DARK) tint.offsetHSL(0, 0, Math.sin(partIndex * 17.13) * 0.025);
    const normal = flat.getAttribute("normal");
    const faceTint = new Color();
    const colors = new Float32Array(flat.getAttribute("position").count * 3);
    for (let vertex = 0; vertex < normal.count; vertex++) {
      // Upward stone faces catch a pale worn edge; recesses keep their depth.
      const wear = color === DARK ? 0 : Math.max(0, normal.getY(vertex)) * 0.035;
      faceTint
        .copy(tint)
        .offsetHSL(0, 0, wear)
        .toArray(colors, vertex * 3);
    }
    flat.setAttribute("color", new Float32BufferAttribute(colors, 3));
    return flat;
  });
  const merged = mergeGeometries(geometries)!;
  for (const geometry of new Set([...geometries, ...parts.map((part) => part.geometry)])) geometry.dispose();
  // Preserve face normals, UV seams and stone colors while sharing equivalent triangle vertices.
  const indexed = mergeVertices(merged, 1e-6);
  merged.dispose();
  return indexed;
}

function cutStoneBlock(width: number, height: number, depth: number): BufferGeometry {
  const bevel = Math.min(width, height, depth) * 0.12;
  const x = width / 2 - bevel;
  const y = height / 2 - bevel;
  const outline = new Shape();
  outline.moveTo(-x, -y);
  outline.lineTo(x, -y);
  outline.lineTo(x, y);
  outline.lineTo(-x, y);
  outline.closePath();
  return new ExtrudeGeometry(outline, {
    depth: depth - 2 * bevel,
    steps: 1,
    bevelEnabled: true,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelSegments: 1,
    curveSegments: 1,
  }).translate(0, 0, -depth / 2 + bevel);
}

function taperedFin(lowerReach: number, upperReach: number): BufferGeometry {
  const geometry = new BoxGeometry(1, 1, 0.08);
  const position = geometry.getAttribute("position");
  for (let vertex = 0; vertex < position.count; vertex++) {
    const upper = position.getY(vertex) > 0;
    const reach = upper ? upperReach : lowerReach;
    position.setXYZ(vertex, (position.getX(vertex) + 0.5) * reach, position.getY(vertex) + 0.5, position.getZ(vertex));
  }
  geometry.computeVertexNormals();
  return geometry;
}

function beamBetween(start: Vector3, end: Vector3, width: number): BufferGeometry {
  const direction = end.clone().sub(start);
  const rotation = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction.clone().normalize());
  const center = start.clone().add(end).multiplyScalar(0.5);
  return new BoxGeometry(width, direction.length(), width)
    .applyQuaternion(rotation)
    .translate(center.x, center.y, center.z);
}

function foundation(): BufferGeometry {
  const parts: Part[] = [];
  for (let tier = 0; tier < 3; tier++) {
    const radius = 0.89 - tier * 0.055;
    const thickness = HYPERSTRUCTURE_BASE_HEIGHT / 3;
    parts.push(
      piece(
        new CylinderGeometry(radius, radius + 0.025, thickness, 6),
        tier === 2 ? EDGE : STONE,
        0,
        (tier + 0.5) * thickness,
      ),
    );
  }
  for (let socket = 0; socket < 6; socket++) {
    const angle = (socket * Math.PI) / 3;
    const x = Math.sin(angle) * 0.7,
      z = Math.cos(angle) * 0.7;
    parts.push(piece(cutStoneBlock(0.14, 0.24, 0.14), STONE, x, 0.23, z, angle));
    parts.push(piece(cutStoneBlock(0.17, 0.045, 0.17), GOLD, x, 0.35, z, angle));
  }
  return combine(parts);
}

function shaftCourse(family: HyperstructureFamily, index: number): BufferGeometry {
  switch (family) {
    case "citadel":
      return citadelCourse(index);
    case "needle":
      return needleCourse(index);
    case "helix":
      return helixCourse(index);
    case "trident":
      return tridentCourse(index);
    case "obelisk":
      return obeliskCourse(index);
    case "reliquary":
      return reliquaryCourse(index);
  }
}

function citadelCourse(index: number): BufferGeometry {
  const parts = [piece(cutStoneBlock(0.56, 1, 0.56), STONE, 0, 0.5)];
  for (const x of [-0.32, 0.32])
    for (const z of [-0.32, 0.32]) {
      parts.push(piece(new CylinderGeometry(0.105, 0.125, 1, 4), EDGE, x, 0.5, z, Math.PI / 4));
      if (index % 3 === 0) parts.push(piece(cutStoneBlock(0.2, 0.08, 0.2), GOLD, x, 0.88, z));
    }
  parts.push(piece(cutStoneBlock(0.6, 0.055, 0.6), EDGE, 0, 0.965));
  addWindows(parts, 4, 0.288, index);
  addMasonryJoints(parts, 4, 0.4, Math.PI / 4);
  if (index < 3) {
    for (const side of [-1, 1]) {
      parts.push(piece(new CylinderGeometry(0.08, 0.15, 1, 4), STONE, side * 0.54, 0.5, 0, Math.PI / 4));
      if (index === 2) parts.push(piece(cutStoneBlock(0.16, 0.08, 0.16), EDGE, side * 0.54, 0.96));
    }
  }
  return combine(parts);
}

function needleCourse(index: number): BufferGeometry {
  const parts = [piece(new CylinderGeometry(0.26, 0.29, 1, 8), STONE, 0, 0.5)];
  for (let rib = 0; rib < 8; rib++) {
    const angle = (rib * Math.PI) / 4;
    const radius = index < 2 ? 0.37 : 0.29;
    parts.push(
      piece(
        new CylinderGeometry(0.045, index < 2 ? 0.12 : 0.065, 1, 3),
        EDGE,
        Math.sin(angle) * radius,
        0.5,
        Math.cos(angle) * radius,
        angle,
      ),
    );
  }
  addWindows(parts, 8, 0.262, index, Math.PI / 8);
  if (index === 2 || index === 6) parts.push(piece(new CylinderGeometry(0.34, 0.3, 0.09, 8), GOLD, 0, 0.95));
  return combine(parts);
}

/** Deform complete courses from the same height profile so their seams meet exactly. */
function shapeContinuousCourse(
  parts: Part[],
  index: number,
  profile: (level: number) => { radius: number; yaw: number },
): BufferGeometry {
  const geometry = combine(parts);
  const positions = geometry.getAttribute("position");
  for (let vertex = 0; vertex < positions.count; vertex++) {
    const y = positions.getY(vertex);
    const { radius, yaw } = profile((index + y) / HYPERSTRUCTURE_COURSES);
    const x = positions.getX(vertex),
      z = positions.getZ(vertex);
    positions.setXYZ(
      vertex,
      (x * Math.cos(yaw) + z * Math.sin(yaw)) * radius,
      y,
      (z * Math.cos(yaw) - x * Math.sin(yaw)) * radius,
    );
  }
  geometry.computeVertexNormals();
  return geometry;
}

function helixCourse(index: number): BufferGeometry {
  const parts = [piece(new CylinderGeometry(0.19, 0.19, 1, 8, 8), STONE, 0, 0.5)];
  for (let rib = 0; rib < 3; rib++) {
    const angle = (rib * Math.PI * 2) / 3;
    const x = Math.sin(angle),
      z = Math.cos(angle);
    parts.push(piece(new CylinderGeometry(0.1, 0.1, 1, 6, 8), EDGE, x * 0.34, 0.5, z * 0.34, angle));
    parts.push(piece(new BoxGeometry(0.025, 1, 0.025, 1, 8, 1), GOLD, x * 0.435, 0.5, z * 0.435, angle));
    // Stone brackets join each spiral rib to the central tower.
    if (index % 2 === 0 || index === 7) {
      parts.push(piece(cutStoneBlock(0.12, 0.16, 0.32), STONE, x * 0.24, 0.88, z * 0.24, angle));
      parts.push(piece(cutStoneBlock(0.14, 0.04, 0.34), GOLD, x * 0.24, 0.98, z * 0.24, angle));
    }
  }
  addWindows(parts, 8, 0.185, index, Math.PI / 8);
  return shapeContinuousCourse(parts, index, (level) => ({ radius: 1 - level * 0.3, yaw: level * 1.8 }));
}

function tridentCourse(index: number): BufferGeometry {
  const parts: Part[] = [];
  for (let tower = 0; tower < 3; tower++) {
    const angle = (tower * Math.PI * 2) / 3;
    const x = Math.sin(angle),
      z = Math.cos(angle);
    parts.push(piece(new CylinderGeometry(0.145, 0.145, 1, 6, 8), STONE, x * 0.29, 0.5, z * 0.29, angle));
    // Tall pale blades give the three joined spires a readable outer edge.
    parts.push(piece(new BoxGeometry(0.065, 1, 0.09, 1, 8, 1), EDGE, x * 0.42, 0.5, z * 0.42, angle));
    parts.push(piece(cutStoneBlock(0.05, 0.62, 0.025), DARK, x * 0.418, 0.5, z * 0.418, angle));
    if (index < 2 || index >= 6) {
      parts.push(piece(cutStoneBlock(0.13, 1, 0.34), STONE, x * 0.13, 0.5, z * 0.13, angle));
    } else if (index === 2 || index === 5) {
      const foot = new Vector3(x * 0.29, 0.04, z * 0.29);
      const apex = new Vector3(0, index === 2 ? 0.8 : 0.92, 0);
      parts.push(piece(beamBetween(foot, apex, 0.11), EDGE));
    }
    if (index === 1 || index === 6) {
      parts.push(piece(new CylinderGeometry(0.165, 0.165, 0.06, 6), GOLD, x * 0.29, 0.92, z * 0.29, angle));
    }
  }
  if (index === 5) parts.push(piece(new CylinderGeometry(0.43, 0.39, 0.12, 6), EDGE, 0, 0.94));
  if (index === 7) parts.push(piece(new CylinderGeometry(0.39, 0.3, 0.12, 6), EDGE, 0, 0.94));
  return shapeContinuousCourse(parts, index, (level) => ({
    radius: 0.82 + Math.sin(level * Math.PI) * 0.26 - level * 0.2,
    yaw: 0,
  }));
}

function obeliskCourse(index: number): BufferGeometry {
  const parts = [piece(new CylinderGeometry(0.31, 0.34, 1, 4), STONE, 0, 0.5, 0, Math.PI / 4)];
  for (const side of [-1, 1]) {
    parts.push(piece(cutStoneBlock(0.055, 1, 0.54), EDGE, side * 0.23, 0.5));
    const lowerReach = 0.38 * (1 - index / HYPERSTRUCTURE_COURSES);
    const upperReach = Math.max(0.015, 0.38 * (1 - (index + 1) / HYPERSTRUCTURE_COURSES));
    parts.push(piece(taperedFin(lowerReach, upperReach), EDGE, side * 0.2, 0, 0, side < 0 ? Math.PI : 0));
  }
  addWindows(parts, 4, 0.232, index);
  parts.push(piece(cutStoneBlock(0.49, 0.035, 0.49), index % 4 === 0 ? GOLD : EDGE, 0, 0.96));
  return combine(parts);
}

function reliquaryCourse(index: number): BufferGeometry {
  const parts: Part[] = [];
  const hasFloor = index === 1 || index === 5 || index === 7;
  if (index < 2) {
    parts.push(piece(new CylinderGeometry(0.36, 0.36, 1, 6), STONE, 0, 0.5));
    addWindows(parts, 6, 0.315, index, Math.PI / 6);
  } else {
    parts.push(piece(new CylinderGeometry(0.105, 0.105, 1, 6), DARK, 0, 0.5));
  }
  for (let pillar = 0; pillar < 6; pillar++) {
    const angle = (pillar * Math.PI) / 3;
    const x = Math.sin(angle) * 0.34,
      z = Math.cos(angle) * 0.34;
    parts.push(piece(new CylinderGeometry(0.065, 0.065, 1, 6), EDGE, x, 0.5, z, angle));
    if (index === 0 || index === 2 || index === 6) {
      parts.push(piece(new CylinderGeometry(0.085, 0.085, 0.09, 6), STONE, x, 0.045, z, angle));
    }
    if (hasFloor) {
      const nextAngle = angle + Math.PI / 3;
      const apex = new Vector3(Math.sin(angle + Math.PI / 6) * 0.29, 0.9, Math.cos(angle + Math.PI / 6) * 0.29);
      parts.push(piece(beamBetween(new Vector3(x, 0.06, z), apex, 0.065), GOLD));
      parts.push(
        piece(
          beamBetween(new Vector3(Math.sin(nextAngle) * 0.34, 0.06, Math.cos(nextAngle) * 0.34), apex, 0.065),
          EDGE,
        ),
      );
    }
  }
  if (hasFloor) {
    parts.push(piece(new CylinderGeometry(0.5, 0.46, 0.14, 6), STONE, 0, 0.93));
    parts.push(piece(new CylinderGeometry(0.49, 0.49, 0.025, 6), GOLD, 0, 0.86));
  }
  if (index === 4) parts.push(piece(new OctahedronGeometry(1).scale(0.2, 0.44, 0.2), GOLD, 0, 0.5));
  return shapeContinuousCourse(parts, index, (level) => ({ radius: 1 - level * 0.25, yaw: 0 }));
}

function addWindows(parts: Part[], faces: number, radius: number, index: number, offset = 0): void {
  for (let face = 0; face < faces; face++) {
    const angle = (face * Math.PI * 2) / faces + offset;
    const x = Math.sin(angle) * radius,
      z = Math.cos(angle) * radius;
    parts.push(piece(new BoxGeometry(0.065, index === 0 ? 0.8 : 0.58, 0.025), DARK, x, 0.45, z, angle));
    parts.push(piece(new BoxGeometry(0.085, 0.025, 0.04), GOLD, x, 0.16, z, angle));
  }
}

function addMasonryJoints(parts: Part[], sides: number, radius: number, yaw: number): void {
  for (let joint = 1; joint < 4; joint++) {
    parts.push(piece(new CylinderGeometry(radius, radius, 0.014, sides), DARK, 0, joint / 4, 0, yaw));
  }
}

function crownCollar(): BufferGeometry {
  return combine([
    piece(new CylinderGeometry(0.3, 0.36, 0.12, 6), STONE, 0, 0.06),
    piece(new TorusGeometry(0.31, 0.014, 4, 6).rotateX(Math.PI / 2), GOLD, 0, 0.13),
  ]);
}

function crownProngs(): BufferGeometry {
  const parts: Part[] = [];
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    parts.push(
      piece(new CylinderGeometry(0.009, 0.085, 0.82, 4), EDGE, Math.sin(a) * 0.27, 0.41, Math.cos(a) * 0.27, a),
    );
    parts.push(piece(new CylinderGeometry(0.006, 0.018, 0.7, 4), GOLD, Math.sin(a) * 0.3, 0.39, Math.cos(a) * 0.3, a));
  }
  return combine(parts);
}

function astrolabe(): BufferGeometry {
  return combine([
    piece(new CylinderGeometry(0.007, 0.04, 0.9, 5), GOLD, 0.38, 0.45),
    piece(new CylinderGeometry(0.007, 0.04, 0.9, 5), GOLD, -0.38, 0.45),
  ]);
}

function petals(): BufferGeometry {
  const parts: Part[] = [];
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI * 2) / 3;
    const blade = new OctahedronGeometry(1).scale(0.065, 0.33, 0.085).rotateZ(-0.16);
    parts.push(piece(blade, EDGE, Math.sin(a) * 0.34, 0.54, Math.cos(a) * 0.34, a));
  }
  return combine(parts);
}

function crystals(): BufferGeometry {
  return combine(
    Array.from({ length: 6 }, (_, i) => {
      const a = (i * Math.PI) / 3;
      return piece(
        new OctahedronGeometry(1).scale(0.045, i % 2 ? 0.16 : 0.27, 0.045),
        i % 2 ? GOLD : EDGE,
        Math.sin(a) * 0.28,
        i % 2 ? 0.36 : 0.52,
        Math.cos(a) * 0.28,
        a,
      );
    }),
  );
}

function crescent(): BufferGeometry {
  const start = Math.PI * 0.225;
  const sweep = Math.PI * 1.55;
  const parts = [piece(new TorusGeometry(0.33, 0.047, 5, 30, sweep).rotateZ(start), EDGE, 0, 0.43)];
  for (const angle of [start, start + sweep]) {
    parts.push(piece(new SphereGeometry(0.047, 8, 4), GOLD, Math.cos(angle) * 0.33, 0.43 + Math.sin(angle) * 0.33));
  }
  return combine(parts);
}

function cage(): BufferGeometry {
  const parts: Part[] = [];
  const foot = new Vector3(0, 0.12, 0);
  const apex = new Vector3(0, 0.85, 0);
  for (let side = 0; side < 4; side++) {
    const angle = (side * Math.PI) / 2;
    const shoulder = new Vector3(Math.sin(angle) * 0.38, 0.44, Math.cos(angle) * 0.38);
    parts.push(piece(beamBetween(foot, shoulder, 0.028), GOLD));
    parts.push(piece(beamBetween(shoulder, apex, 0.028), GOLD));
    parts.push(piece(new OctahedronGeometry(0.043), EDGE, shoulder.x, shoulder.y, shoulder.z));
  }
  parts.push(piece(new OctahedronGeometry(1).scale(0.06, 0.06, 0.06), EDGE, 0, apex.y));
  return combine(parts);
}

function spear(): BufferGeometry {
  return combine([piece(new OctahedronGeometry(1).scale(0.15, 0.04, 0.15), GOLD, 0, 0.1)]);
}

function wings(side: number): BufferGeometry {
  return combine([
    piece(new OctahedronGeometry(1).scale(0.13, 0.36, 0.075), EDGE),
    piece(new OctahedronGeometry(1).scale(0.027, 0.32, 0.03), GOLD, 0, 0, side * 0.07),
  ]);
}

function crownInlays(): BufferGeometry {
  const parts: Part[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    parts.push(piece(new BoxGeometry(0.012, 0.6, 0.014), "#ffffff", Math.sin(a) * 0.313, 0.46, Math.cos(a) * 0.313, a));
  }
  return combine(parts);
}

function stoneGrain(): DataTexture {
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const hash = Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263);
      const grain = ((hash ^ (hash >>> 13)) >>> 0) % 39;
      const value = 204 + grain;
      const offset = (y * size + x) * 4;
      data.set([value, value, value, 255], offset);
    }
  const texture = new DataTexture(data, size, size);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.repeat.set(3, 3);
  texture.needsUpdate = true;
  return texture;
}
