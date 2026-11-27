import type { MapSiteKind } from "@/config/map-sites";
import {
  BoxGeometry,
  BufferGeometry,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  OctahedronGeometry,
  Path,
  Shape,
  TorusGeometry,
} from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import MeshStandardNodeMaterial from "three/src/materials/nodes/MeshStandardNodeMaterial.js";
import {
  bumpMap,
  float,
  mix,
  mx_noise_float,
  normalView,
  positionGeometry,
  positionViewDirection,
  positionWorld,
  pow,
  sin,
  smoothstep,
  vec2,
  vec3,
} from "three/tsl";
import { mapAnimationTime } from "../effects/endgame/state";
import { FrostedStandardNodeMaterial } from "../effects/game-map-material-library";
import { createProcgenMasonryMaterial } from "./procgen-masonry-material";
import { asProceduralGltf, combineParts, type KitPart, piece } from "./realm-kit-primitives";

export const WELL_SITE_MODEL_PATH = "procedural:well-shrine:well";
export const SHRINE_SITE_MODEL_PATH = "procedural:well-shrine:shrine";

export const WELL_SHRINE_PATHS = {
  Well: WELL_SITE_MODEL_PATH,
  Shrine: SHRINE_SITE_MODEL_PATH,
} as const satisfies Record<MapSiteKind, string>;

const WELL_WATER_KEY = "eternum-procgen-well-water-v1";
const SHRINE_AURA_KEY = "eternum-procgen-shrine-aura-v1";

const WELL_STONE = "#7c8388";
const WELL_STONE_LIGHT = "#9aa0a4";
const WELL_STONE_DARK = "#596066";
const WELL_SHAFT = "#263038";
const WELL_MOSS = "#5c6e4f";
const WELL_TIMBER = "#7c5230";
const WELL_TIMBER_DARK = "#59381f";
const WELL_SHINGLE = "#4c5b67";
const WELL_SHINGLE_EDGE = "#6a7985";
const WELL_ROPE = "#b89f6e";
const WELL_BRONZE = "#c49442";

const SHRINE_STONE = "#ddd4c2";
const SHRINE_STONE_LIGHT = "#ece5d8";
const SHRINE_STONE_SHADE = "#b9af9c";
const SHRINE_GOLD = "#d6a43c";
const SHRINE_GOLD_BRIGHT = "#e9be54";
const SHRINE_BRONZE = "#b58230";

const DEEP_WATER_COLOR = vec3(0.05, 0.34, 0.38);
const SHALLOW_WATER_COLOR = vec3(0.18, 0.66, 0.64);
const WATER_CREST_COLOR = vec3(0.68, 0.94, 0.92);
const WATER_CAUSTIC_COLOR = vec3(0.12, 0.56, 0.6);

const AURA_BASE_COLOR = vec3(1.0, 0.86, 0.48);
const AURA_CORE_COLOR = vec3(1.0, 0.96, 0.76);
const AURA_EMISSIVE_COLOR = vec3(1.3, 0.84, 0.24);

class WellWaterNodeMaterial extends FrostedStandardNodeMaterial {
  constructor() {
    super();
    this.name = "Procgen well water";
    this.roughness = 0.14;
    this.metalness = 0.08;
    this.flatShading = false;
    const radial = vec2(positionGeometry.x, positionGeometry.z).length();
    const swirl = mx_noise_float(positionWorld.mul(7.5));
    const waveA = sin(radial.mul(36).sub(mapAnimationTime.mul(3.1)));
    const waveB = sin(radial.mul(60).add(mapAnimationTime.mul(2.0)).add(swirl.mul(2.3)));
    const ripple = waveA.mul(0.58).add(waveB.mul(0.42));
    const crest = smoothstep(0.38, 0.95, ripple);
    this.normalNode = bumpMap(ripple, float(0.026));
    this.colorNode = mix(DEEP_WATER_COLOR, SHALLOW_WATER_COLOR, smoothstep(0.04, 0.25, radial)).add(
      WATER_CREST_COLOR.mul(crest.mul(0.24)),
    );
    this.emissiveNode = WATER_CAUSTIC_COLOR.mul(crest.mul(0.38).add(0.16));
  }

  override customProgramCacheKey(): string {
    return WELL_WATER_KEY;
  }
}

class ShrineAuraNodeMaterial extends MeshStandardNodeMaterial {
  constructor() {
    super();
    this.name = "Procgen shrine aura";
    this.roughness = 0.18;
    this.metalness = 0.1;
    this.flatShading = false;
    const pulse = sin(mapAnimationTime.mul(2.4)).mul(0.18).add(1.0);
    const shimmer = sin(positionWorld.y.mul(16.0).sub(mapAnimationTime.mul(3.6)))
      .mul(0.12)
      .add(1.0);
    const fresnel = pow(normalView.dot(positionViewDirection).abs().clamp(0, 1).oneMinus(), float(2.0));
    this.colorNode = mix(AURA_BASE_COLOR, AURA_CORE_COLOR, fresnel.mul(0.6));
    this.emissiveNode = AURA_EMISSIVE_COLOR.mul(pulse).mul(shimmer).mul(fresnel.mul(0.65).add(0.95));
  }

  override customProgramCacheKey(): string {
    return SHRINE_AURA_KEY;
  }
}

export function createWellKit(): GLTF {
  const masonryParts: KitPart[] = [];
  addWellStoneBody(masonryParts);
  addWellTimberCanopy(masonryParts);
  addWellWindlassAndBucket(masonryParts);

  const root = new Group();
  root.name = "well-procgen-kit";

  const masonryMesh = new Mesh(combineParts(masonryParts), createProcgenMasonryMaterial());
  masonryMesh.name = "well:masonry";

  const waterGeometry = new CircleGeometry(0.262, 28);
  waterGeometry.rotateX(-Math.PI / 2);
  waterGeometry.translate(0, 0.278, 0);
  const waterMesh = new Mesh(waterGeometry, new WellWaterNodeMaterial());
  waterMesh.name = "well:water";

  root.add(masonryMesh, waterMesh);
  return asProceduralGltf(root);
}

export function createShrineKit(): GLTF {
  const masonryParts: KitPart[] = [];
  addShrineSteppedPlinth(masonryParts);
  addShrineColumnsAndArchitrave(masonryParts);
  addShrineAltarAndSunburst(masonryParts);

  const root = new Group();
  root.name = "shrine-procgen-kit";

  const masonryMesh = new Mesh(combineParts(masonryParts), createProcgenMasonryMaterial());
  masonryMesh.name = "shrine:masonry";

  const auraMesh = new Mesh(buildShrineAuraGeometry(), new ShrineAuraNodeMaterial());
  auraMesh.name = "shrine:aura";

  root.add(masonryMesh, auraMesh);
  return asProceduralGltf(root);
}

export function isWellShrineKitPath(path: string): boolean {
  return path === WELL_SITE_MODEL_PATH || path === SHRINE_SITE_MODEL_PATH;
}

export function resolveProceduralWellShrineKit(path: string): GLTF | null {
  if (path === WELL_SITE_MODEL_PATH) return createWellKit();
  if (path === SHRINE_SITE_MODEL_PATH) return createShrineKit();
  return null;
}

function addWellStoneBody(parts: KitPart[]): void {
  parts.push(piece(hollowRing(0.44, 0.255, 0.06, 8, Math.PI / 8), WELL_STONE_DARK, 0, 0, 0));
  parts.push(piece(hollowRing(0.375, 0.264, 0.32, 16), WELL_STONE, 0, 0.05, 0));
  parts.push(piece(hollowRing(0.394, 0.264, 0.04, 16), WELL_STONE_LIGHT, 0, 0.2, 0));
  parts.push(piece(hollowRing(0.432, 0.256, 0.072, 16), WELL_STONE_LIGHT, 0, 0.365, 0));
  parts.push(piece(hollowRing(0.266, 0.254, 0.22, 16), WELL_SHAFT, 0, 0.16, 0));

  for (let index = 0; index < 4; index++) {
    const angle = (index * Math.PI) / 2 + Math.PI / 4;
    const cx = Math.cos(angle) * 0.39;
    const cz = Math.sin(angle) * 0.39;
    parts.push(piece(new BoxGeometry(0.11, 0.22, 0.11), WELL_STONE_DARK, cx, 0.11, cz, angle));
    parts.push(piece(new BoxGeometry(0.125, 0.04, 0.125), WELL_MOSS, cx, 0.23, cz, angle));
  }

  for (let index = 0; index < 8; index++) {
    const angle = (index * Math.PI) / 4;
    const rx = Math.cos(angle) * 0.345;
    const rz = Math.sin(angle) * 0.345;
    parts.push(piece(new BoxGeometry(0.16, 0.016, 0.032), WELL_STONE_DARK, rx, 0.438, rz, angle));
  }
}

function addWellTimberCanopy(parts: KitPart[]): void {
  for (const side of [-1, 1]) {
    const px = side * 0.365;
    parts.push(piece(new BoxGeometry(0.14, 0.16, 0.14), WELL_STONE_DARK, px, 0.08, 0));
    parts.push(piece(new BoxGeometry(0.074, 0.74, 0.074), WELL_TIMBER, px, 0.42, 0));
    parts.push(piece(new BoxGeometry(0.088, 0.036, 0.088), WELL_BRONZE, px, 0.46, 0));
    parts.push(piece(new BoxGeometry(0.088, 0.036, 0.088), WELL_BRONZE, px, 0.72, 0));

    const brace = new BoxGeometry(0.044, 0.2, 0.048);
    brace.rotateZ(side * 0.78);
    parts.push(piece(brace, WELL_TIMBER_DARK, side * 0.28, 0.67, 0));
  }

  parts.push(piece(new BoxGeometry(0.84, 0.058, 0.076), WELL_TIMBER_DARK, 0, 0.755, 0));

  const slopeAngle = 0.54;
  for (const slope of [-1, 1]) {
    const roof = new BoxGeometry(0.94, 0.044, 0.43);
    roof.rotateX(slope * slopeAngle);
    parts.push(piece(roof, WELL_SHINGLE, 0, 0.84, slope * 0.178));

    const trim = new BoxGeometry(0.96, 0.028, 0.055);
    trim.rotateX(slope * slopeAngle);
    parts.push(piece(trim, WELL_SHINGLE_EDGE, 0, 0.735, slope * 0.355));
  }

  parts.push(piece(new BoxGeometry(0.96, 0.055, 0.068), WELL_TIMBER_DARK, 0, 0.942, 0));
  for (const side of [-1, 1]) {
    parts.push(piece(new ConeGeometry(0.032, 0.072, 6), WELL_BRONZE, side * 0.45, 0.985, 0));
  }
}

function addWellWindlassAndBucket(parts: KitPart[]): void {
  const axle = new CylinderGeometry(0.026, 0.026, 0.78, 12);
  axle.rotateZ(Math.PI / 2);
  parts.push(piece(axle, WELL_TIMBER, 0, 0.56, 0));

  const ropeCoil = new CylinderGeometry(0.044, 0.044, 0.16, 14);
  ropeCoil.rotateZ(Math.PI / 2);
  parts.push(piece(ropeCoil, WELL_ROPE, 0, 0.56, 0));

  parts.push(piece(new BoxGeometry(0.022, 0.11, 0.022), WELL_BRONZE, 0.425, 0.515, 0));
  const handle = new CylinderGeometry(0.014, 0.014, 0.095, 10);
  handle.rotateZ(Math.PI / 2);
  parts.push(piece(handle, WELL_BRONZE, 0.47, 0.47, 0));

  parts.push(piece(new CylinderGeometry(0.011, 0.011, 0.19, 8), WELL_ROPE, 0, 0.465, 0));
  parts.push(piece(new CylinderGeometry(0.068, 0.052, 0.095, 14), WELL_TIMBER, 0, 0.34, 0));
  parts.push(piece(new CylinderGeometry(0.07, 0.067, 0.014, 14), WELL_BRONZE, 0, 0.37, 0));
  parts.push(piece(new CylinderGeometry(0.058, 0.055, 0.014, 14), WELL_BRONZE, 0, 0.312, 0));

  const bail = new TorusGeometry(0.056, 0.008, 6, 16, Math.PI);
  parts.push(piece(bail, WELL_BRONZE, 0, 0.382, 0));
}

function addShrineSteppedPlinth(parts: KitPart[]): void {
  parts.push(piece(new CylinderGeometry(0.61, 0.635, 0.095, 6), SHRINE_STONE_SHADE, 0, 0.0475, 0, Math.PI / 6));
  parts.push(piece(new CylinderGeometry(0.515, 0.535, 0.09, 6), SHRINE_STONE, 0, 0.14, 0, Math.PI / 6));
  parts.push(piece(new CylinderGeometry(0.535, 0.54, 0.018, 6), SHRINE_BRONZE, 0, 0.1, 0, Math.PI / 6));
  parts.push(piece(new CylinderGeometry(0.42, 0.435, 0.09, 6), SHRINE_STONE_LIGHT, 0, 0.23, 0, Math.PI / 6));
  parts.push(piece(new CylinderGeometry(0.435, 0.44, 0.018, 6), SHRINE_GOLD, 0, 0.275, 0, Math.PI / 6));
}

function addShrineColumnsAndArchitrave(parts: KitPart[]): void {
  const columnRadius = 0.345;
  for (let index = 0; index < 6; index++) {
    const angle = (index * Math.PI) / 3 + Math.PI / 6;
    const cx = Math.cos(angle) * columnRadius;
    const cz = Math.sin(angle) * columnRadius;
    parts.push(piece(new BoxGeometry(0.095, 0.05, 0.095), SHRINE_STONE_SHADE, cx, 0.3, cz, angle));
    parts.push(piece(new CylinderGeometry(0.034, 0.042, 0.43, 10), SHRINE_STONE_LIGHT, cx, 0.54, cz));
    parts.push(piece(new CylinderGeometry(0.044, 0.042, 0.022, 10), SHRINE_GOLD, cx, 0.745, cz));
    parts.push(piece(new BoxGeometry(0.095, 0.042, 0.095), SHRINE_STONE, cx, 0.775, cz, angle));
    parts.push(piece(new ConeGeometry(0.026, 0.065, 6), SHRINE_GOLD_BRIGHT, cx, 0.905, cz));
  }

  parts.push(piece(hollowRing(0.405, 0.285, 0.075, 6, Math.PI / 6), SHRINE_STONE, 0, 0.79, 0));
  parts.push(piece(hollowRing(0.418, 0.275, 0.022, 6, Math.PI / 6), SHRINE_GOLD, 0, 0.858, 0));
}

function addShrineAltarAndSunburst(parts: KitPart[]): void {
  parts.push(piece(new CylinderGeometry(0.145, 0.18, 0.065, 8), SHRINE_STONE_SHADE, 0, 0.3075, 0));
  parts.push(piece(new CylinderGeometry(0.115, 0.135, 0.21, 8), SHRINE_STONE_LIGHT, 0, 0.445, 0));
  parts.push(piece(new CylinderGeometry(0.155, 0.13, 0.04, 8), SHRINE_STONE, 0, 0.565, 0));
  parts.push(piece(new CylinderGeometry(0.135, 0.088, 0.065, 12), SHRINE_BRONZE, 0, 0.615, 0));
  parts.push(piece(new CylinderGeometry(0.145, 0.138, 0.016, 12), SHRINE_GOLD_BRIGHT, 0, 0.65, 0));

  for (let index = 0; index < 4; index++) {
    const angle = (index * Math.PI) / 2 + Math.PI / 4;
    const rx = Math.cos(angle) * 0.125;
    const rz = Math.sin(angle) * 0.125;
    parts.push(piece(new BoxGeometry(0.026, 0.21, 0.026), SHRINE_GOLD, rx, 0.445, rz, angle));
  }

  for (const side of [-1, 1]) {
    const strut = new BoxGeometry(0.032, 0.18, 0.032);
    strut.rotateZ(side * 0.58);
    parts.push(piece(strut, SHRINE_BRONZE, side * 0.21, 0.89, 0));
  }

  const sunCenterY = 1.035;
  parts.push(piece(new TorusGeometry(0.152, 0.026, 10, 28), SHRINE_GOLD, 0, sunCenterY, 0));
  for (let index = 0; index < 8; index++) {
    const angle = (index * Math.PI) / 4;
    const rayLen = index % 2 === 0 ? 0.095 : 0.072;
    const ray = new ConeGeometry(0.024, rayLen, 4);
    ray.translate(0, 0.165 + rayLen / 2, 0);
    ray.rotateZ(-angle);
    parts.push(piece(ray, index % 2 === 0 ? SHRINE_GOLD_BRIGHT : SHRINE_GOLD, 0, sunCenterY, 0));
  }
}

function buildShrineAuraGeometry(): BufferGeometry {
  return combineParts([
    piece(new IcosahedronGeometry(0.086, 1), SHRINE_GOLD_BRIGHT, 0, 1.035, 0),
    piece(new TorusGeometry(0.118, 0.011, 8, 28), SHRINE_GOLD_BRIGHT, 0, 1.035, 0),
    piece(new OctahedronGeometry(0.066, 1), SHRINE_GOLD_BRIGHT, 0, 0.695, 0),
  ]);
}

function hollowRing(
  outerRadius: number,
  innerRadius: number,
  height: number,
  segments: number,
  phase = 0,
): BufferGeometry {
  const shape = new Shape();
  for (let index = 0; index <= segments; index++) {
    const angle = phase + (index / segments) * Math.PI * 2;
    const x = Math.cos(angle) * outerRadius;
    const y = Math.sin(angle) * outerRadius;
    if (index === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  const hole = new Path();
  for (let index = 0; index <= segments; index++) {
    const angle = phase - (index / segments) * Math.PI * 2;
    const x = Math.cos(angle) * innerRadius;
    const y = Math.sin(angle) * innerRadius;
    if (index === 0) hole.moveTo(x, y);
    else hole.lineTo(x, y);
  }
  shape.holes.push(hole);
  const geometry = new ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, curveSegments: 1 });
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}
