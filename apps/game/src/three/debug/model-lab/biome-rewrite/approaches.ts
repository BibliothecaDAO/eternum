import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  SRGBColorSpace,
  type Object3D,
} from "three";
import {
  attribute,
  color,
  float,
  fwidth,
  mix,
  mx_noise_float,
  normalLocal,
  positionLocal,
  positionWorld,
  sin,
  smoothstep,
  step,
  time,
  vec2,
  vec3,
} from "three/tsl";
import { MeshStandardNodeMaterial } from "three/webgpu";
import { terrainHexCorners } from "../../../terrain/terrain-coordinates";
import { terrainHexEdgeDistance } from "../../../terrain/terrain-hex-node";
import { smoothstep as smooth, type SandWaterCell, type SandWaterWorld } from "./sand-water-world";

export type BiomeRewriteApproach = "procedural" | "tiles" | "painted" | "lowpoly";

export interface BuiltApproach {
  group: Object3D;
  /** Where an army or a structure stands at a world position. */
  standAt(x: number, z: number): number;
  triangles: number;
  materials: number;
  /** Where the open sea around the region lies; tiles keep it below their feet so their gaps read as gaps. */
  seaLevel: number;
}

export const BIOME_REWRITE_APPROACHES: ReadonlyArray<{ id: BiomeRewriteApproach; label: string }> = [
  { id: "procedural", label: "1 · Procedural heightfield + shaders" },
  { id: "tiles", label: "2 · Modelled hex tiles (stand-in kit)" },
  { id: "painted", label: "3 · Baked painted region" },
  { id: "lowpoly", label: "4 · Stylised low-poly" },
];

export function buildApproach(id: BiomeRewriteApproach, world: SandWaterWorld): BuiltApproach {
  switch (id) {
    case "procedural":
      return buildProcedural(world);
    case "tiles":
      return buildModelledTiles(world);
    case "painted":
      return buildPaintedRegion(world);
    case "lowpoly":
      return buildLowPoly(world);
  }
}

const SAND_DRY = "#e6cb92";
const SAND_DEEP = "#c49a5e";
const SAND_WET = "#9f8257";
const WATER_SHALLOW = "#63d2c4";
const WATER_MID = "#2f9bb0";
const WATER_DEEP = "#1a4a78";
const FOAM = "#f4f7f2";

/** A grid over the region at `step`, its heights from `heightAt`, as one indexed mesh. */
function buildGrid(world: SandWaterWorld, step: number, heightAt: (x: number, z: number) => number) {
  const { minX, maxX, minZ, maxZ } = world.bounds;
  const columns = Math.ceil((maxX - minX) / step) + 1;
  const rows = Math.ceil((maxZ - minZ) / step) + 1;
  const positions = new Float32Array(columns * rows * 3);
  const depths = new Float32Array(columns * rows);
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const x = minX + column * step,
        z = minZ + row * step;
      const index = row * columns + column;
      const ground = world.groundAt(x, z);
      positions.set([x, heightAt(x, z), z], index * 3);
      depths[index] = Math.max(0, -ground);
    }
  }
  const indices: number[] = [];
  for (let row = 0; row < rows - 1; row++) {
    for (let column = 0; column < columns - 1; column++) {
      const a = row * columns + column;
      indices.push(a, a + columns, a + 1, a + 1, a + columns, a + columns + 1);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("waterDepth", new BufferAttribute(depths, 1));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** The gameplay grid, faint, on any surface: the map stays a hex board whatever draws the ground. */
const hexLines = (strength: number) => {
  const edge = terrainHexEdgeDistance(positionWorld.xz);
  return smoothstep(0.012, fwidth(edge).mul(1.2).add(0.012), edge).oneMinus().mul(strength);
};

/** 1. One continuous heightfield; sand and water are shaders: ripples, wet band, depth-coloured waves and foam. */
function buildProcedural(world: SandWaterWorld): BuiltApproach {
  const height = (x: number, z: number) => Math.max(world.groundAt(x, z), -0.7) + world.dunesAt(x, z);
  const sandGeometry = buildGrid(world, 0.12, height);
  const sand = new MeshStandardNodeMaterial({ roughness: 0.9, metalness: 0 });
  const ground = positionLocal.y;
  const wind = vec2(0.86, 0.5);
  const ripplePhase = positionLocal.xz
    .dot(wind)
    .mul(26)
    .add(mx_noise_float(positionLocal.xz.mul(1.3)).mul(4));
  const rippleFade = smoothstep(0.6, 2.2, fwidth(ripplePhase)).oneMinus();
  const ripples = sin(ripplePhase)
    .mul(rippleFade)
    .mul(smoothstep(0.03, 0.12, ground));
  const drift = mx_noise_float(positionLocal.xz.mul(0.45)).mul(0.5).add(0.5);
  const dry = mix(color(SAND_DEEP), color(SAND_DRY), drift.mul(0.6).add(normalLocal.y.mul(0.4)));
  const wet = smoothstep(0.0, 0.075, ground).oneMinus();
  sand.colorNode = mix(mix(dry, color(SAND_WET), wet), vec3(0.22, 0.2, 0.16), hexLines(0.22)).mul(
    ripples.mul(0.07).add(1),
  );
  sand.roughnessNode = mix(float(0.92), float(0.35), wet);
  const water = new MeshStandardNodeMaterial({ roughness: 0.18, metalness: 0, transparent: true });
  const depth = attribute<"float">("waterDepth", "float");
  const waves = sin(positionLocal.x.mul(1.7).add(time.mul(1.1)))
    .add(sin(positionLocal.z.mul(2.3).sub(time.mul(0.9))))
    .mul(0.012);
  water.positionNode = positionLocal.add(vec3(0, waves.mul(smoothstep(0, 0.08, depth)), 0));
  const tone = mix(
    mix(color(WATER_SHALLOW), color(WATER_MID), smoothstep(0.0, 0.18, depth)),
    color(WATER_DEEP),
    smoothstep(0.18, 0.55, depth),
  );
  const surf = sin(depth.mul(90).sub(time.mul(2.2)))
    .mul(0.5)
    .add(0.5);
  const foam = smoothstep(0.0, 0.035, depth)
    .oneMinus()
    .max(step(0.82, surf).mul(smoothstep(0.02, 0.09, depth).oneMinus()));
  water.colorNode = mix(mix(tone, color(FOAM), foam), vec3(0.1, 0.18, 0.24), hexLines(0.18));
  water.opacityNode = smoothstep(0.0, 0.006, depth).mul(0.94);
  const waterGeometry = buildGrid(world, 0.12, () => 0);
  const group = new Group();
  group.add(withShadows(new Mesh(sandGeometry, sand)), new Mesh(waterGeometry, water));
  return {
    group,
    standAt: (x, z) => Math.max(height(x, z), 0),
    triangles: triangleCount(sandGeometry) + triangleCount(waterGeometry),
    materials: 2,
    seaLevel: -0.05,
  };
}

/** 2. A tile per hex, as a modelled kit would deliver: bevelled tiles, variants turned by the seed, water recessed. */
function buildModelledTiles(world: SandWaterWorld): BuiltApproach {
  const land = new TileBuilder();
  const water = new TileBuilder();
  const top = new Map<string, number>();
  for (const cell of world.cells) {
    const wetEdges = waterEdges(world, cell);
    if (cell.kind === "deep" || cell.kind === "shallow") {
      const level = cell.kind === "deep" ? -0.16 : -0.07;
      land.addTile(
        cell,
        level - 0.02,
        () => 0,
        () => new Color(SAND_WET).multiplyScalar(0.7),
      );
      water.addTile(
        cell,
        -0.02,
        () => 0,
        (u) => {
          const shore = landProximity(world, cell, u);
          return new Color(cell.kind === "deep" ? WATER_DEEP : WATER_SHALLOW).lerp(new Color(FOAM), shore);
        },
        0.04,
      );
      top.set(`${cell.col}:${cell.row}`, -0.02);
      continue;
    }
    const base = cell.kind === "beach" ? 0.06 : 0.16;
    const variant = tileHash(cell.col, cell.row);
    const turn = Math.floor(variant * 6) * (Math.PI / 3);
    land.addTile(
      cell,
      base,
      (lx, lz) => {
        const rx = lx * Math.cos(turn) - lz * Math.sin(turn);
        const rz = lx * Math.sin(turn) + lz * Math.cos(turn);
        const dune =
          cell.kind === "desert" ? (1 - Math.abs(Math.sin(rx * 2.2 + rz * 0.8 + variant * 6))) ** 2 * 0.12 : 0;
        const slope = wetEdges.reduce((low, edge) => Math.min(low, edgeFall(lx, lz, edge)), 0);
        return dune * smooth(0.25, 0.6, Math.hypot(lx, lz)) + slope;
      },
      (u, lx, lz) => {
        const wetness = wetEdges.reduce((most, edge) => Math.max(most, -edgeFall(lx, lz, edge) / 0.08), 0);
        const sun = 0.92 + ((u * 7919) % 1) * 0.08;
        return new Color(cell.kind === "beach" ? "#ead6a6" : SAND_DRY)
          .multiplyScalar(sun)
          .lerp(new Color(SAND_WET), Math.min(1, wetness));
      },
    );
    top.set(`${cell.col}:${cell.row}`, base);
  }
  const landMesh = withShadows(
    new Mesh(land.finish(), new MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: false })),
  );
  const waterMaterial = new MeshStandardNodeMaterial({ roughness: 0.2, metalness: 0, vertexColors: true });
  const phase = attribute<"float">("tilePhase", "float");
  waterMaterial.positionNode = positionLocal.add(vec3(0, sin(time.mul(1.4).add(phase.mul(6.28))).mul(0.012), 0));
  const waterMesh = new Mesh(water.finish(), waterMaterial);
  const group = new Group();
  group.add(landMesh, waterMesh);
  return {
    group,
    standAt: (x, z) => {
      const hex = nearestCell(world, x, z);
      return top.get(`${hex.col}:${hex.row}`) ?? 0;
    },
    triangles: triangleCount(landMesh.geometry) + triangleCount(waterMesh.geometry),
    materials: 2,
    seaLevel: -0.7,
  };
}

/** 3. The region baked once: a coarse mesh and one painted texture (hillshade, wet band, shallows, foam lines). */
function buildPaintedRegion(world: SandWaterWorld): BuiltApproach {
  const height = (x: number, z: number) => Math.max(world.groundAt(x, z), 0) + world.dunesAt(x, z);
  const geometry = buildGrid(world, 0.3, height);
  const { minX, maxX, minZ, maxZ } = world.bounds;
  const width = 2048;
  const tall = Math.round((width * (maxZ - minZ)) / (maxX - minX));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = tall;
  const context = canvas.getContext("2d")!;
  const image = context.createImageData(width, tall);
  const sandDry = new Color(SAND_DRY),
    sandDeep = new Color(SAND_DEEP),
    sandWet = new Color(SAND_WET),
    shallow = new Color(WATER_SHALLOW),
    mid = new Color(WATER_MID),
    deep = new Color(WATER_DEEP),
    foam = new Color(FOAM),
    paint = new Color();
  const texel = (maxX - minX) / width;
  for (let py = 0; py < tall; py++) {
    for (let px = 0; px < width; px++) {
      const x = minX + px * texel,
        z = minZ + py * texel;
      const ground = world.groundAt(x, z);
      const stroke = brush(x, z);
      if (ground < 0) {
        const depth = -ground;
        const band = Math.floor(smooth(0, 0.5, depth) * 4 + stroke * 0.6) / 4;
        paint
          .copy(shallow)
          .lerp(mid, Math.min(1, band * 1.6))
          .lerp(deep, Math.max(0, band * 1.6 - 0.6));
        const line = Math.abs(depth - 0.025) < 0.012 + stroke * 0.006 || Math.abs(depth - 0.08) < 0.004 * (1 + stroke);
        if (depth < 0.012 || line) paint.lerp(foam, depth < 0.012 ? 0.9 : 0.55);
      } else {
        const dunes = world.dunesAt(x, z);
        const slope = (world.dunesAt(x + 0.1, z + 0.06) - dunes) * 9 + (world.groundAt(x + 0.1, z) - ground) * 3;
        const shade = Math.max(0, Math.min(1, 0.55 - slope + (stroke - 0.5) * 0.25));
        paint
          .copy(sandDeep)
          .lerp(sandDry, shade)
          .lerp(sandWet, smooth(0.07, 0.0, ground));
      }
      const offset = (py * width + px) * 4;
      image.data[offset] = paint.r * 255;
      image.data[offset + 1] = paint.g * 255;
      image.data[offset + 2] = paint.b * 255;
      image.data[offset + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  drawPaintedHexLines(context, world, width / (maxX - minX));
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  const uvs = new Float32Array(geometry.getAttribute("position").count * 2);
  const position = geometry.getAttribute("position");
  for (let index = 0; index < position.count; index++) {
    uvs[index * 2] = (position.getX(index) - minX) / (maxX - minX);
    uvs[index * 2 + 1] = 1 - (position.getZ(index) - minZ) / (maxZ - minZ);
  }
  geometry.setAttribute("uv", new BufferAttribute(uvs, 2));
  const mesh = withShadows(new Mesh(geometry, new MeshStandardMaterial({ map: texture, roughness: 1, metalness: 0 })));
  const group = new Group();
  group.add(mesh);
  return { group, standAt: height, triangles: triangleCount(geometry), materials: 1, seaLevel: -0.05 };
}

/** 4. Flat-shaded facets: sand in a few tones, water in depth bands with moving facets and a crisp foam rim. */
function buildLowPoly(world: SandWaterWorld): BuiltApproach {
  const step = 0.55;
  const { minX, maxX, minZ, maxZ } = world.bounds;
  const height = (x: number, z: number) => Math.max(world.groundAt(x, z), 0) * 1.4 + world.dunesAt(x, z) * 1.6;
  const landPositions: number[] = [],
    landColors: number[] = [],
    waterPositions: number[] = [],
    waterColors: number[] = [];
  const tone = new Color();
  const rowHeight = step * (Math.sqrt(3) / 2);
  for (let row = 0; minZ + row * rowHeight < maxZ; row++) {
    for (let column = 0; minX + column * step < maxX; column++) {
      const shift = row % 2 ? step / 2 : 0;
      const a = [minX + column * step + shift, minZ + row * rowHeight];
      const b = [a[0] + step, a[1]];
      const c = [a[0] + step / 2, a[1] + rowHeight];
      const d = [a[0] - step / 2, a[1] + rowHeight];
      for (const triangle of [
        [a, c, b],
        [a, d, c],
      ]) {
        const cx = (triangle[0][0] + triangle[1][0] + triangle[2][0]) / 3;
        const cz = (triangle[0][1] + triangle[1][1] + triangle[2][1]) / 3;
        const ground = world.groundAt(cx, cz);
        if (ground >= 0) {
          const level = height(cx, cz);
          tone
            .set(level < 0.05 ? SAND_WET : level > 0.24 ? SAND_DEEP : SAND_DRY)
            .offsetHSL(0, 0, (tileHash(column, row) - 0.5) * 0.04);
          for (const [x, z] of triangle)
            (landPositions.push(x, height(x, z), z), landColors.push(tone.r, tone.g, tone.b));
        } else {
          const depth = -ground;
          tone.set(depth < 0.035 ? FOAM : depth < 0.16 ? WATER_SHALLOW : depth < 0.36 ? WATER_MID : WATER_DEEP);
          for (const [x, z] of triangle) (waterPositions.push(x, 0, z), waterColors.push(tone.r, tone.g, tone.b));
        }
      }
    }
  }
  const landGeometry = flatGeometry(landPositions, landColors);
  const waterGeometry = flatGeometry(waterPositions, waterColors);
  const landMesh = withShadows(
    new Mesh(landGeometry, new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 })),
  );
  const waterMaterial = new MeshStandardNodeMaterial({ vertexColors: true, flatShading: true, roughness: 0.3 });
  waterMaterial.positionNode = positionLocal.add(
    vec3(0, sin(positionLocal.x.mul(2.1).add(positionLocal.z.mul(1.3)).add(time.mul(1.2))).mul(0.025), 0),
  );
  const group = new Group();
  group.add(landMesh, new Mesh(waterGeometry, waterMaterial));
  return {
    group,
    standAt: (x, z) => Math.max(height(x, z), 0),
    triangles: triangleCount(landGeometry) + triangleCount(waterGeometry),
    materials: 2,
    seaLevel: -0.05,
  };
}

/** Hex tile geometry: a fan top with rings, a bevel, and side walls down to the tile's foot. */
class TileBuilder {
  private positions: number[] = [];
  private colors: number[] = [];
  private phases: number[] = [];

  addTile(
    cell: SandWaterCell,
    level: number,
    relief: (lx: number, lz: number) => number,
    paint: (u: number, lx: number, lz: number) => Color,
    inset = 0.03,
  ): void {
    const corners = terrainHexCorners(cell.col, cell.row).map((corner) => ({
      lx: (corner.x - cell.x) * (1 - inset),
      lz: (corner.z - cell.z) * (1 - inset),
    }));
    const rings = 4;
    const phase = tileHash(cell.row, cell.col);
    const point = (edge: number, ring: number, along: number) => {
      const a = corners[edge],
        b = corners[(edge + 1) % 6];
      const t = ring / rings;
      return { lx: (a.lx + (b.lx - a.lx) * along) * t, lz: (a.lz + (b.lz - a.lz) * along) * t };
    };
    const push = (lx: number, lz: number, y: number, colour: Color) => {
      this.positions.push(cell.x + lx, y, cell.z + lz);
      this.colors.push(colour.r, colour.g, colour.b);
      this.phases.push(phase);
    };
    const vertex = (lx: number, lz: number) => {
      const bevel = smooth(0.82, 1, Math.hypot(lx, lz) / 0.95) * 0.03;
      push(lx, lz, level + relief(lx, lz) - bevel, paint(Math.abs(lx * 13.1 + lz * 7.7), lx, lz));
    };
    for (let edge = 0; edge < 6; edge++) {
      for (let ring = 0; ring < rings; ring++) {
        for (let step = 0; step <= ring; step++) {
          const inner = (s: number) => (ring === 0 ? { lx: 0, lz: 0 } : point(edge, ring, s / ring));
          const outer = (s: number) => point(edge, ring + 1, s / (ring + 1));
          const p0 = inner(step),
            p1 = outer(step),
            p2 = outer(step + 1);
          (vertex(p0.lx, p0.lz), vertex(p2.lx, p2.lz), vertex(p1.lx, p1.lz));
          if (step < ring) {
            const p3 = inner(step + 1);
            (vertex(p0.lx, p0.lz), vertex(p3.lx, p3.lz), vertex(p2.lx, p2.lz));
          }
        }
      }
      const a = corners[edge],
        b = corners[(edge + 1) % 6];
      const topA = level + relief(a.lx, a.lz) - 0.03,
        topB = level + relief(b.lx, b.lz) - 0.03;
      const side = paint(0.5, a.lx, a.lz).clone().multiplyScalar(0.62);
      const foot = level - 0.45;
      (push(a.lx, a.lz, topA, side), push(b.lx, b.lz, foot, side), push(b.lx, b.lz, topB, side));
      (push(a.lx, a.lz, topA, side), push(a.lx, a.lz, foot, side), push(b.lx, b.lz, foot, side));
    }
  }

  finish(): BufferGeometry {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(new Float32Array(this.positions), 3));
    geometry.setAttribute("color", new BufferAttribute(new Float32Array(this.colors), 3));
    geometry.setAttribute("tilePhase", new BufferAttribute(new Float32Array(this.phases), 1));
    geometry.computeVertexNormals();
    return geometry;
  }
}

/** The directions (as unit vectors from the tile centre) of a land tile's edges that face water. */
function waterEdges(world: SandWaterWorld, cell: SandWaterCell): Array<{ x: number; z: number }> {
  if (cell.kind === "deep" || cell.kind === "shallow") return [];
  const result: Array<{ x: number; z: number }> = [];
  for (const other of world.cells) {
    const dx = other.x - cell.x,
      dz = other.z - cell.z;
    const distance = Math.hypot(dx, dz);
    if (distance > 0.1 && distance < 1.9 && (other.kind === "deep" || other.kind === "shallow")) {
      result.push({ x: dx / distance, z: dz / distance });
    }
  }
  return result;
}

/** How far a point on a land tile drops toward a water edge: a beach that runs into the sea. */
function edgeFall(lx: number, lz: number, edge: { x: number; z: number }): number {
  const toward = lx * edge.x + lz * edge.z;
  return -smooth(0.35, 0.86, toward) * 0.08;
}

function landProximity(world: SandWaterWorld, cell: SandWaterCell, u: number): number {
  void u;
  return world.groundAt(cell.x, cell.z) > -0.05 ? 0.25 : 0;
}

function nearestCell(world: SandWaterWorld, x: number, z: number): SandWaterCell {
  let best = world.cells[0];
  for (const cell of world.cells) {
    if ((cell.x - x) ** 2 + (cell.z - z) ** 2 < (best.x - x) ** 2 + (best.z - z) ** 2) best = cell;
  }
  return best;
}

function drawPaintedHexLines(context: CanvasRenderingContext2D, world: SandWaterWorld, pixelsPerUnit: number): void {
  context.strokeStyle = "rgba(60, 46, 30, 0.22)";
  context.lineWidth = 1.4;
  for (const cell of world.cells) {
    const corners = terrainHexCorners(cell.col, cell.row);
    context.beginPath();
    corners.forEach((corner, index) => {
      const px = (corner.x - world.bounds.minX) * pixelsPerUnit;
      const py = (corner.z - world.bounds.minZ) * pixelsPerUnit;
      if (index === 0) context.moveTo(px, py);
      else context.lineTo(px, py);
    });
    context.closePath();
    context.stroke();
  }
}

/** Anisotropic value noise along the wind: what a brush leaves. Deterministic in world position. */
function brush(x: number, z: number): number {
  const u = x * 0.86 + z * 0.5,
    v = -x * 0.5 + z * 0.86;
  return (
    (Math.sin(u * 7.3 + Math.sin(v * 1.9) * 2.1) * 0.5 + 0.5) * 0.6 +
    tileHash(Math.floor(u * 9), Math.floor(v * 3)) * 0.4
  );
}

function flatGeometry(positions: number[], colors: number[]): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("color", new BufferAttribute(new Float32Array(colors), 3));
  geometry.computeVertexNormals();
  return geometry;
}

function withShadows<T extends Mesh>(mesh: T): T {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function triangleCount(geometry: BufferGeometry): number {
  return (geometry.index ? geometry.index.count : geometry.getAttribute("position").count) / 3;
}

function tileHash(a: number, b: number): number {
  let hash = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263);
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
  return ((hash ^ (hash >>> 16)) >>> 0) / 4294967296;
}
