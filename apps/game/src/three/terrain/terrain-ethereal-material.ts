import { applyGameEndFrost } from "../effects/game-end-freeze";
import type Node from "three/src/nodes/core/Node.js";
import {
  attribute,
  color,
  float,
  fwidth,
  mix,
  normalLocal,
  positionWorld,
  smoothstep,
  transformNormalToView,
  vec2,
  vec3,
} from "three/tsl";
import { MeshStandardNodeMaterial } from "three/webgpu";
import { createEtherealSurfacePalette } from "./ethereal-surface-palette";
import { BASALT_BLOCK_RADIUS } from "./terrain-basalt";

/** Clean regular basalt: geometry supplies relief; stone itself never emits light. */
export function createEtherealTerrainMaterial(): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial({ metalness: 0, roughness: 0.9 });
  material.name = "terrain-ethereal-basalt";
  material.colorNode = applyGameEndFrost(attribute("terrainColor", "vec3"));
  return material;
}

/** Analytic hex shading preserves slab readability after real bevels become subpixel. */
export function createEtherealTerrainFarMaterial(): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial({ metalness: 0, roughness: 0.9 });
  material.name = "terrain-ethereal-basalt-distant";
  const radius = BASALT_BLOCK_RADIUS;
  const spacing = vec2(Math.sqrt(3) * radius, 3 * radius);
  const ground = positionWorld.xz;
  const a = ground.sub(ground.div(spacing).round().mul(spacing));
  const b = ground.sub(spacing.mul(0.5)).sub(ground.sub(spacing.mul(0.5)).div(spacing).round().mul(spacing));
  const delta = a.dot(a).lessThanEqual(b.dot(b)).select(a, b);
  const blockCenter = ground.sub(delta);
  const row = blockCenter.y.div(1.5 * radius).round();
  const col = blockCenter.x
    .div(Math.sqrt(3) * radius)
    .sub(row.mul(0.5))
    .round();
  const q = col.mod(4).add(4).mod(4);
  const r = row.mod(4).add(4).mod(4);
  const variation = q.mul(114).add(r.mul(218)).add(q.mul(r).mul(17)).mod(251).div(251);
  const xDistance = delta.x.abs();
  const diagonalA = delta.x.mul(0.5).add(delta.y.mul(Math.sqrt(3) / 2));
  const diagonalB = delta.x.mul(-0.5).add(delta.y.mul(Math.sqrt(3) / 2));
  const distance = xDistance.max(diagonalA.abs()).max(diagonalB.abs());
  const slabEdge = ((radius - 0.004) * Math.sqrt(3)) / 2;
  const capEdge = ((radius - 0.008) * Math.sqrt(3)) / 2;
  const pixel = fwidth(distance).max(0.0001);
  const slab = smoothstep(float(slabEdge).sub(pixel), float(slabEdge).add(pixel), distance).oneMinus();
  const stone = vec3(0.035, 0.04, 0.049).mul(variation.mul(0.3).add(0.85));
  material.colorNode = applyGameEndFrost(
    mix(vec3(0.017, 0.02, 0.026), stone, slab).mul(attribute("terrainColor", "vec3")),
  );

  const faceX = vec2(delta.x.sign(), 0);
  const faceA = vec2(0.5, Math.sqrt(3) / 2).mul(diagonalA.sign());
  const faceB = vec2(-0.5, Math.sqrt(3) / 2).mul(diagonalB.sign());
  const face = xDistance
    .greaterThanEqual(diagonalA.abs().max(diagonalB.abs()))
    .select(faceX, diagonalA.abs().greaterThanEqual(diagonalB.abs()).select(faceA, faceB));
  const bevel = smoothstep(float(capEdge).sub(pixel), float(capEdge).add(pixel), distance).mul(slab);
  const slope = bevel.mul(0.004 / (slabEdge - capEdge));
  const relief = vec3(face.x.mul(slope), 1, face.y.mul(slope)).normalize();
  material.normalNode = transformNormalToView(normalLocal.y.greaterThan(0.5).select(relief, normalLocal));
  return material;
}

/** Reuse the existing cloud field in fog: no extra noise samples, geometry, or hidden world data. */
export function createEtherealEnergy(ground: Node<"vec2">, drift: Node<"float">, cloud: Node<"float">): Node<"vec3"> {
  const palette = createEtherealSurfacePalette();
  const contour = cloud.sub(0.51).abs();
  const pixelWidth = fwidth(cloud).max(0.001);
  const thread = smoothstep(0.003, pixelWidth.add(0.009), contour).oneMinus();
  const halo = smoothstep(0.008, 0.065, contour).oneMinus().mul(0.13);
  const pulse = ground.x.mul(0.7).add(ground.y.mul(0.43)).sub(drift.mul(0.42)).sin().mul(0.5).add(0.5);
  const flowingLight = smoothstep(0.35, 0.94, pulse).mul(0.8).add(0.2);
  return mix(color(palette.edgeColor), color(palette.glowColor), pulse).mul(thread.add(halo)).mul(flowingLight);
}
