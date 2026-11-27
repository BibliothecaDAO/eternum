import {
  AnimationClip,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  FrontSide,
  Group,
  Mesh,
  NumberKeyframeTrack,
  SphereGeometry,
  Vector3,
} from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { mergeGeometries, mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import MeshBasicNodeMaterial from "three/src/materials/nodes/MeshBasicNodeMaterial.js";
import type Node from "three/src/nodes/core/Node.js";
import {
  abs,
  attribute,
  clamp,
  color,
  cos,
  exp,
  float,
  mix,
  mx_noise_float,
  normalView,
  positionLocal,
  positionViewDirection,
  pow,
  sin,
  smoothstep,
  vec3,
} from "three/tsl";
import { applyEndgameFrost } from "../effects/endgame/field";
import { mapAnimationTime } from "../effects/endgame/state";
import { createProcgenMasonryMaterial } from "./procgen-masonry-material";

export const SPIRE_MODEL_PATH = "procedural:spire";

const SPIRE_PORTAL_RADIUS = 0.3;
const SPIRE_PORTAL_Y = 0.53;
const SPIRE_APEX_Y = 3.959;
const SPIRE_LOOP_DURATION = 8;

const SPIRE_BASALT_CACHE_KEY = "eternum-spire-basalt-v1";
const SPIRE_PORTAL_CACHE_KEY = "eternum-spire-portal-v1";
const SPIRE_HOVER_GROUP_NAME = "SPIRE • suspended basalt core";
const SPIRE_PORTAL_GROUP_NAME = "PORTAL • spherical dimensional rift";
const SPIRE_HOVER_AMPLITUDE = 0.026;
const HEX_SIDES = 6;
const SQRT3 = Math.sqrt(3);

interface AxialCell {
  readonly q: number;
  readonly r: number;
  readonly ring: 0 | 1 | 2;
}

interface BasaltPiece {
  readonly geometry: BufferGeometry;
  readonly color: string;
  readonly veinColor?: readonly [number, number, number];
}

interface SatelliteSpec {
  readonly angle: number;
  readonly radius: number;
  readonly y: number;
  readonly hexRadius: number;
  readonly height: number;
  readonly tiltX: number;
  readonly tiltZ: number;
  readonly yaw: number;
  readonly tone: string;
}

const VEIN_PALETTE: readonly (readonly [number, number, number])[] = [
  [0.06, 0.44, 1.0],
  [1.0, 0.34, 0.06],
  [1.0, 0.1, 0.52],
];

const VEIN_BASE_HEX: readonly string[] = ["#3888ff", "#ff6830", "#ff3898"];

const OUTCROP_HEX_CELLS = buildConcentricHexCells();

const SATELLITE_SPECS: readonly SatelliteSpec[] = [
  {
    angle: 0.38,
    radius: 0.51,
    y: 1.26,
    hexRadius: 0.056,
    height: 0.3,
    tiltX: 0.18,
    tiltZ: -0.14,
    yaw: 0.4,
    tone: "#39404c",
  },
  {
    angle: 1.42,
    radius: 0.47,
    y: 2.38,
    hexRadius: 0.048,
    height: 0.28,
    tiltX: -0.16,
    tiltZ: 0.21,
    yaw: 1.1,
    tone: "#313742",
  },
  {
    angle: 2.34,
    radius: 0.55,
    y: 1.66,
    hexRadius: 0.062,
    height: 0.34,
    tiltX: 0.22,
    tiltZ: 0.15,
    yaw: 0.8,
    tone: "#3f4754",
  },
  {
    angle: 3.28,
    radius: 0.46,
    y: 2.98,
    hexRadius: 0.044,
    height: 0.25,
    tiltX: -0.2,
    tiltZ: -0.16,
    yaw: 1.9,
    tone: "#353c48",
  },
  {
    angle: 4.18,
    radius: 0.54,
    y: 1.92,
    hexRadius: 0.054,
    height: 0.31,
    tiltX: 0.15,
    tiltZ: 0.22,
    yaw: 2.4,
    tone: "#2e343e",
  },
  {
    angle: 5.06,
    radius: 0.45,
    y: 3.36,
    hexRadius: 0.039,
    height: 0.22,
    tiltX: -0.14,
    tiltZ: 0.18,
    yaw: 0.2,
    tone: "#3c4452",
  },
  {
    angle: 5.84,
    radius: 0.49,
    y: 2.66,
    hexRadius: 0.046,
    height: 0.26,
    tiltX: 0.19,
    tiltZ: -0.19,
    yaw: 1.5,
    tone: "#323844",
  },
];

export function createSpireKit(): GLTF {
  const scene = new Group();
  scene.name = "Spire kit";

  const outcrop = buildOutcropMesh();
  scene.add(outcrop);

  const hoverGroup = new Group();
  hoverGroup.name = SPIRE_HOVER_GROUP_NAME;
  hoverGroup.add(buildHoveringSpireMesh());
  scene.add(hoverGroup);

  const portalGroup = new Group();
  portalGroup.name = SPIRE_PORTAL_GROUP_NAME;
  portalGroup.position.y = SPIRE_PORTAL_Y;
  portalGroup.add(buildPortalMesh());
  scene.add(portalGroup);

  return {
    scene,
    scenes: [scene],
    animations: [createSpireLoopClip()],
    cameras: [],
    asset: { version: "2.0" },
    parser: null,
    userData: {},
  } as unknown as GLTF;
}

function buildOutcropMesh(): Mesh {
  const spacing = 0.236;
  const columnRadius = 0.138;
  const parts: BasaltPiece[] = OUTCROP_HEX_CELLS.map((cell, index) => {
    const center = axialToWorld(cell, spacing);
    const seed = hash01(index * 13.7 + 1.3);
    const topY = cell.ring === 0 ? 0.104 : cell.ring === 1 ? 0.108 + seed * 0.047 : 0.047 + seed * 0.033;
    const tone = index % 3 === 0 ? "#282e38" : index % 3 === 1 ? "#313844" : "#3a4250";
    const geometry = buildFlatBeveledHexColumn(center.x, center.z, columnRadius, -0.006, topY, 0.011);
    return { geometry, color: tone };
  });

  const mesh = new Mesh(mergeBasaltPieces(parts, false), createProcgenMasonryMaterial());
  mesh.name = "OUTCROP / dark rooted basalt";
  mesh.userData.spirePart = "outcrop";
  return mesh;
}

function buildHoveringSpireMesh(): Mesh {
  const parts: BasaltPiece[] = [
    ...buildSpireShaftColumns(),
    ...buildSatelliteFragments(),
    ...buildVerticalMineralVeins(),
  ];

  const mesh = new Mesh(mergeBasaltPieces(parts, true), createSpireBasaltMaterial());
  mesh.name = "SPIRE / Basalt";
  mesh.userData.spirePart = "spire";
  return mesh;
}

function buildSpireShaftColumns(): BasaltPiece[] {
  const spacing = 0.156;
  const columnRadius = 0.091;
  const parts: BasaltPiece[] = [];

  OUTCROP_HEX_CELLS.forEach((cell, index) => {
    const center = axialToWorld(cell, spacing);
    const seed = hash01(index * 19.3 + 4.1);
    const seedAlt = hash01(index * 7.9 + 2.7);
    const tone = index % 3 === 0 ? "#313742" : index % 3 === 1 ? "#3c4350" : "#292f39";

    if (cell.ring === 0) {
      parts.push({
        geometry: buildCentralSpireShaft(columnRadius * 1.05),
        color: "#38404d",
      });
      return;
    }

    const bottomBase = cell.ring === 1 ? 1.06 + seed * 0.24 : 1.38 + seed * 0.44;
    const topOuter = cell.ring === 1 ? 2.74 + seedAlt * 0.44 : 1.98 + seedAlt * 0.56;
    const topInner = Math.min(3.438, topOuter + (cell.ring === 1 ? 0.24 : 0.18));
    const bottomInner = Math.max(0.95, bottomBase - (cell.ring === 1 ? 0.11 : 0.15));
    const segments = cell.ring === 1 ? 4 : 3;

    parts.push({
      geometry: buildSlopedHexColumn(
        center.x,
        center.z,
        columnRadius * (cell.ring === 1 ? 1.01 : 0.94),
        bottomInner,
        bottomBase,
        topOuter,
        topInner,
        segments,
      ),
      color: tone,
    });
  });

  return parts;
}

function buildSatelliteFragments(): BasaltPiece[] {
  return SATELLITE_SPECS.map((spec) => {
    const x = Math.cos(spec.angle) * spec.radius;
    const z = Math.sin(spec.angle) * spec.radius;
    const geometry = buildDoublePointedHexShard(spec.hexRadius, spec.height)
      .rotateX(spec.tiltX)
      .rotateZ(spec.tiltZ)
      .rotateY(spec.yaw)
      .translate(x, spec.y, z);
    return { geometry, color: spec.tone };
  });
}

function buildVerticalMineralVeins(): BasaltPiece[] {
  const spacing = 0.156;
  const columnRadius = 0.091;
  const parts: BasaltPiece[] = [];
  const ring1 = ringCentersOrdered(1, spacing);
  const ring2 = ringCentersOrdered(2, spacing);

  ring2.forEach((cell, index) => {
    const next = ring2[(index + 1) % ring2.length];
    const midX = (cell.x + next.x) * 0.5;
    const midZ = (cell.z + next.z) * 0.5;
    const len = Math.hypot(midX, midZ) || 1;
    const push = columnRadius * 0.72;
    const x = midX + (midX / len) * push;
    const z = midZ + (midZ / len) * push;
    const angle = Math.atan2(z, x);
    const seed = hash01(index * 17.3 + 2.1);
    const height = 0.14 + seed * 0.075;
    const centerY = 1.62 + (index % 3) * 0.16 + seed * 0.06;
    const colorIndex = index % VEIN_PALETTE.length;
    parts.push({
      geometry: buildCrystalVeinSliver(0.017, height, 0.026)
        .rotateY(-angle + Math.PI * 0.5)
        .translate(x, centerY, z),
      color: VEIN_BASE_HEX[colorIndex],
      veinColor: VEIN_PALETTE[colorIndex],
    });
  });

  for (let tier = 0; tier < 2; tier++) {
    ring1.forEach((cell, index) => {
      const next = ring1[(index + 1) % ring1.length];
      const midX = (cell.x + next.x) * 0.5;
      const midZ = (cell.z + next.z) * 0.5;
      const len = Math.hypot(midX, midZ) || 1;
      const push = columnRadius * 0.88;
      const x = midX + (midX / len) * push;
      const z = midZ + (midZ / len) * push;
      const angle = Math.atan2(z, x);
      const seed = hash01((index + tier * 6) * 29.1 + 5.7);
      const height = 0.145 + seed * 0.07;
      const centerY = tier === 0 ? 2.34 + seed * 0.24 : 2.86 + seed * 0.26;
      const colorIndex = (index + tier + 1) % VEIN_PALETTE.length;
      parts.push({
        geometry: buildCrystalVeinSliver(0.016, height, 0.024)
          .rotateY(-angle + Math.PI * 0.5)
          .translate(x, centerY, z),
        color: VEIN_BASE_HEX[colorIndex],
        veinColor: VEIN_PALETTE[colorIndex],
      });
    });
  }

  return parts;
}

function ringCentersOrdered(ring: 1 | 2, spacing: number): Array<{ x: number; z: number }> {
  return OUTCROP_HEX_CELLS.filter((cell) => cell.ring === ring)
    .map((cell) => axialToWorld(cell, spacing))
    .sort((a, b) => Math.atan2(a.z, a.x) - Math.atan2(b.z, b.x));
}

function buildPortalMesh(): Mesh {
  const geometry = new SphereGeometry(SPIRE_PORTAL_RADIUS, 32, 20);
  const material = createSpirePortalMaterial();
  const mesh = new Mesh(geometry, material);
  mesh.name = "PORTAL / core";
  mesh.userData.spirePart = "portal";
  mesh.userData.trueSphereRadius = SPIRE_PORTAL_RADIUS;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

function createSpireBasaltMaterial() {
  const material = createProcgenMasonryMaterial();
  material.name = "Spire basalt";
  const veinGlow = attribute("aSpireVein", "vec3").mul(2.8);
  material.emissiveNode = applyEndgameFrost(veinGlow);
  material.customProgramCacheKey = () => SPIRE_BASALT_CACHE_KEY;
  return material;
}

function createSpirePortalMaterial(): MeshBasicNodeMaterial {
  const material = new MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    side: FrontSide,
  });
  material.name = "Spire dimensional portal";
  material.toneMapped = true;
  material.customProgramCacheKey = () => SPIRE_PORTAL_CACHE_KEY;

  const dir = positionLocal.normalize();
  const viewDot = normalView.dot(positionViewDirection).abs().clamp(0, 1);
  const fresnel = pow(viewDot.oneMinus(), float(2.1));
  const rimTight = pow(viewDot.oneMinus(), float(4.2));

  const spinA = mapAnimationTime.mul(1.15);
  const spinB = mapAnimationTime.mul(-1.55);
  const swirlCoord = vec3(
    dir.x.mul(cos(spinA)).sub(dir.z.mul(sin(spinA))),
    dir.y,
    dir.x.mul(sin(spinA)).add(dir.z.mul(cos(spinA))),
  );
  const turbulence = mx_noise_float(swirlCoord.mul(3.4).add(vec3(0, mapAnimationTime.mul(0.85), 0)))
    .mul(0.5)
    .add(0.5);
  const fineNoise = mx_noise_float(
    vec3(
      dir.x.mul(cos(spinB)).sub(dir.z.mul(sin(spinB))),
      dir.y.mul(1.4),
      dir.x.mul(sin(spinB)).add(dir.z.mul(cos(spinB))),
    ).mul(5.8),
  )
    .mul(0.5)
    .add(0.5);

  const pinkRibbon = buildPlasmaRibbon(dir, vec3(0.46, 0.84, 0.28).normalize(), spinA.mul(1.4), 1.0, turbulence);
  const orangeRibbon = buildPlasmaRibbon(
    dir,
    vec3(-0.74, 0.56, 0.37).normalize(),
    spinB.mul(1.3).add(2.1),
    1.35,
    fineNoise,
  );
  const cyanRibbon = buildPlasmaRibbon(
    dir,
    vec3(0.22, -0.45, 0.86).normalize(),
    spinA.mul(-1.7).add(4.2),
    0.9,
    turbulence,
  );

  const voidCore = mix(color("#05010e"), color("#1c0638"), turbulence.mul(0.55).add(fresnel.mul(0.35)));
  const corona = mix(color("#8a34f5"), color("#f046ff"), fineNoise).mul(fresnel.mul(1.65).add(rimTight.mul(1.45)));
  const ribbons = color("#ff2496")
    .mul(pinkRibbon.mul(2.15))
    .add(color("#ff7224").mul(orangeRibbon.mul(2.1)))
    .add(color("#36b8ff").mul(cyanRibbon.mul(1.75)));

  const composed = voidCore.add(corona).add(ribbons);
  material.colorNode = applyEndgameFrost(composed);
  const ribbonStrength = clamp(pinkRibbon.add(orangeRibbon).add(cyanRibbon), float(0), float(1));
  material.opacityNode = clamp(float(0.88).add(fresnel.mul(0.12)).add(ribbonStrength.mul(0.12)), float(0.86), float(1));
  return material;
}

function buildPlasmaRibbon(
  dir: Node<"vec3">,
  axis: Node<"vec3">,
  phase: Node<"float">,
  waveFreq: number,
  noise: Node<"float">,
): Node<"float"> {
  const latitude = dir.dot(axis);
  const warp = noise.sub(0.5).mul(0.28);
  const band = exp(abs(latitude.add(warp)).mul(-11.5));
  const azimuth = dir.x.mul(3.1).add(dir.z.mul(2.7)).add(dir.y.mul(1.9));
  const streak = sin(azimuth.mul(waveFreq).add(phase)).mul(0.5).add(0.5);
  return band.mul(smoothstep(0.18, 0.88, streak).mul(0.75).add(0.25));
}

function createSpireLoopClip(): AnimationClip {
  const samples = 16;
  const times: number[] = [];
  const values: number[] = [];
  for (let step = 0; step <= samples; step++) {
    const t = (step / samples) * SPIRE_LOOP_DURATION;
    times.push(t);
    values.push(Math.sin((step / samples) * Math.PI * 2) * SPIRE_HOVER_AMPLITUDE);
  }
  values[values.length - 1] = values[0];
  return new AnimationClip("Spire_Loop", SPIRE_LOOP_DURATION, [
    new NumberKeyframeTrack(`${SPIRE_HOVER_GROUP_NAME}.position[y]`, times, values),
  ]);
}

function buildConcentricHexCells(): readonly AxialCell[] {
  const cells: AxialCell[] = [{ q: 0, r: 0, ring: 0 }];
  for (let q = -2; q <= 2; q++) {
    for (let r = -2; r <= 2; r++) {
      const s = -q - r;
      const dist = Math.max(Math.abs(q), Math.abs(r), Math.abs(s));
      if (dist === 1 || dist === 2) cells.push({ q, r, ring: dist });
    }
  }
  return cells;
}

function axialToWorld(cell: AxialCell, spacing: number): { x: number; z: number } {
  return {
    x: spacing * (cell.q + cell.r * 0.5),
    z: spacing * (SQRT3 * 0.5 * cell.r),
  };
}

function buildFlatBeveledHexColumn(
  cx: number,
  cz: number,
  radius: number,
  bottomY: number,
  topY: number,
  bevel: number,
): BufferGeometry {
  const positions: number[] = [];
  const ringBottom = hexRing(cx, cz, radius, bottomY);
  const ringShoulder = hexRing(cx, cz, radius, topY - bevel);
  const ringTop = hexRing(cx, cz, radius - bevel, topY);
  const centerTop = new Vector3(cx, topY, cz);
  const centerBottom = new Vector3(cx, bottomY, cz);

  for (let i = 0; i < HEX_SIDES; i++) {
    const next = (i + 1) % HEX_SIDES;
    pushQuad(positions, ringBottom[i], ringBottom[next], ringShoulder[next], ringShoulder[i]);
    pushQuad(positions, ringShoulder[i], ringShoulder[next], ringTop[next], ringTop[i]);
    pushTriangle(positions, ringTop[i], ringTop[next], centerTop);
    pushTriangle(positions, ringBottom[next], ringBottom[i], centerBottom);
  }

  return geometryFromPositions(positions);
}

function buildCentralSpireShaft(radius: number): BufferGeometry {
  const positions: number[] = [];
  const tipBottom = new Vector3(0, 0.93, 0);
  const ringLevels = [1.14, 1.82, 2.58, 3.32, 3.819];
  const rings = ringLevels.map((y, index) => {
    const shrink = index === 0 ? 0.95 : index === ringLevels.length - 1 ? 0.92 : 1;
    return hexRing(0, 0, radius * shrink, y);
  });
  const apex = new Vector3(0, SPIRE_APEX_Y, 0);

  for (let i = 0; i < HEX_SIDES; i++) {
    const next = (i + 1) % HEX_SIDES;
    pushTriangle(positions, rings[0][next], rings[0][i], tipBottom);
  }

  for (let level = 0; level < rings.length - 1; level++) {
    const lower = rings[level];
    const upper = rings[level + 1];
    for (let i = 0; i < HEX_SIDES; i++) {
      const next = (i + 1) % HEX_SIDES;
      pushQuad(positions, lower[i], lower[next], upper[next], upper[i]);
    }
  }

  const crown = rings[rings.length - 1];
  for (let i = 0; i < HEX_SIDES; i++) {
    const next = (i + 1) % HEX_SIDES;
    pushTriangle(positions, crown[i], crown[next], apex);
  }

  return geometryFromPositions(positions);
}

function buildSlopedHexColumn(
  cx: number,
  cz: number,
  radius: number,
  bottomInner: number,
  bottomOuter: number,
  topOuter: number,
  topInner: number,
  segments: number,
): BufferGeometry {
  const positions: number[] = [];
  const radialLen = Math.hypot(cx, cz) || 1;
  const dirX = cx / radialLen;
  const dirZ = cz / radialLen;

  const projectRing = (innerY: number, outerY: number, scale: number) =>
    hexRing(cx, cz, radius * scale, 0).map((vertex) => {
      const along = ((vertex.x - cx) * dirX + (vertex.z - cz) * dirZ) / radius;
      const t = (along + 1) * 0.5;
      return new Vector3(vertex.x, innerY + (outerY - innerY) * t, vertex.z);
    });

  const rings: Vector3[][] = [];
  for (let step = 0; step <= segments; step++) {
    const frac = step / segments;
    const innerY = bottomInner + (topInner - bottomInner) * frac;
    const outerY = bottomOuter + (topOuter - bottomOuter) * frac;
    const pinch = step > 0 && step < segments ? 0.96 : 1;
    rings.push(projectRing(innerY, outerY, pinch));
  }

  const bottomCenter = new Vector3(cx - dirX * radius * 0.25, bottomInner - 0.04, cz - dirZ * radius * 0.25);
  const topCenter = new Vector3(cx - dirX * radius * 0.25, topInner + 0.04, cz - dirZ * radius * 0.25);

  for (let i = 0; i < HEX_SIDES; i++) {
    const next = (i + 1) % HEX_SIDES;
    pushTriangle(positions, rings[0][next], rings[0][i], bottomCenter);
  }

  for (let level = 0; level < rings.length - 1; level++) {
    const lower = rings[level];
    const upper = rings[level + 1];
    for (let i = 0; i < HEX_SIDES; i++) {
      const next = (i + 1) % HEX_SIDES;
      pushQuad(positions, lower[i], lower[next], upper[next], upper[i]);
    }
  }

  const topRing = rings[rings.length - 1];
  for (let i = 0; i < HEX_SIDES; i++) {
    const next = (i + 1) % HEX_SIDES;
    pushTriangle(positions, topRing[i], topRing[next], topCenter);
  }

  return geometryFromPositions(positions);
}

function buildDoublePointedHexShard(radius: number, height: number): BufferGeometry {
  const positions: number[] = [];
  const half = height * 0.5;
  const lower = hexRing(0, 0, radius * 0.88, -half * 0.45);
  const upper = hexRing(0, 0, radius, half * 0.42);
  const bottomTip = new Vector3(0, -half, 0);
  const topTip = new Vector3(0, half, 0);

  for (let i = 0; i < HEX_SIDES; i++) {
    const next = (i + 1) % HEX_SIDES;
    pushTriangle(positions, lower[next], lower[i], bottomTip);
    pushQuad(positions, lower[i], lower[next], upper[next], upper[i]);
    pushTriangle(positions, upper[i], upper[next], topTip);
  }

  return geometryFromPositions(positions);
}

function buildCrystalVeinSliver(width: number, height: number, depth: number): BufferGeometry {
  const positions: number[] = [];
  const hw = width * 0.5;
  const hh = height * 0.5;
  const hd = depth * 0.5;
  const top = new Vector3(0, hh, 0);
  const bottom = new Vector3(0, -hh, 0);
  const ring = [new Vector3(-hw, 0, 0), new Vector3(0, 0, hd), new Vector3(hw, 0, 0), new Vector3(0, 0, -hd)];

  for (let i = 0; i < 4; i++) {
    const next = (i + 1) % 4;
    pushTriangle(positions, ring[i], ring[next], top);
    pushTriangle(positions, ring[next], ring[i], bottom);
  }

  return geometryFromPositions(positions);
}

function mergeBasaltPieces(parts: BasaltPiece[], withVeinAttribute: boolean): BufferGeometry {
  const prepared = parts.map((part, partIndex) => {
    const flat = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry.clone();
    flat.computeVertexNormals();
    const positions = flat.getAttribute("position");
    const normals = flat.getAttribute("normal");
    flat.setAttribute("uv", new Float32BufferAttribute(new Float32Array(positions.count * 2), 2));

    const tint = new Color(part.color);
    if (!part.veinColor) {
      tint.offsetHSL(0, 0, Math.sin(partIndex * 11.3) * 0.022);
    }

    const colors = new Float32Array(positions.count * 3);
    const veins = withVeinAttribute ? new Float32Array(positions.count * 3) : null;
    const faceTint = new Color();

    for (let vertex = 0; vertex < positions.count; vertex++) {
      const y = positions.getY(vertex);
      const ny = normals.getY(vertex);
      const strata = part.veinColor ? 0 : Math.sin(y * 10.5) * 0.014;
      const topCatch = part.veinColor ? 0 : Math.max(0, ny) * 0.045;
      faceTint
        .copy(tint)
        .offsetHSL(0, 0, topCatch + strata)
        .toArray(colors, vertex * 3);
      if (veins && part.veinColor) {
        veins[vertex * 3] = part.veinColor[0];
        veins[vertex * 3 + 1] = part.veinColor[1];
        veins[vertex * 3 + 2] = part.veinColor[2];
      }
    }

    flat.setAttribute("color", new Float32BufferAttribute(colors, 3));
    if (veins) flat.setAttribute("aSpireVein", new Float32BufferAttribute(veins, 3));
    return flat;
  });

  const merged = mergeGeometries(prepared)!;
  for (const geometry of new Set([...prepared, ...parts.map((part) => part.geometry)])) geometry.dispose();
  const indexed = mergeVertices(merged, 1e-6);
  merged.dispose();
  indexed.computeBoundingBox();
  indexed.computeBoundingSphere();
  return indexed;
}

function hexRing(cx: number, cz: number, radius: number, y: number): Vector3[] {
  const vertices: Vector3[] = [];
  for (let i = 0; i < HEX_SIDES; i++) {
    const angle = -(i / HEX_SIDES) * Math.PI * 2 + Math.PI / 6;
    vertices.push(new Vector3(cx + Math.cos(angle) * radius, y, cz + Math.sin(angle) * radius));
  }
  return vertices;
}

function pushTriangle(target: number[], a: Vector3, b: Vector3, c: Vector3): void {
  target.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
}

function pushQuad(target: number[], a: Vector3, b: Vector3, c: Vector3, d: Vector3): void {
  pushTriangle(target, a, b, c);
  pushTriangle(target, a, c, d);
}

function geometryFromPositions(positions: number[]): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function hash01(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}
