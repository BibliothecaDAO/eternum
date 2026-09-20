import { applyGameEndFrost } from "../effects/game-end-freeze";
import type Node from "three/src/nodes/core/Node.js";
import { attribute, color, float, fwidth, mix, positionWorld, smoothstep, vec2, vec3 } from "three/tsl";
import { MeshStandardNodeMaterial } from "three/webgpu";
import { createEtherealSurfacePalette } from "./ethereal-surface-palette";
import { BASALT_BLOCK_RADIUS } from "./terrain-basalt";

/** One surface treatment at every zoom and on both occupied and unoccupied tiles. */
export function createEtherealTerrainMaterial(): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial({ metalness: 0, roughness: 0.9 });
  material.name = "terrain-ethereal-basalt";
  material.colorNode = applyGameEndFrost(
    createBasaltSurface(positionWorld.xz).color.mul(attribute("terrainColor", "vec3")),
  );
  return material;
}

/** Shared with surface-biome transitions; ground coordinates must be world aligned. */
export function createBasaltSurface(ground: Node<"vec2">): { color: Node<"vec3">; softEdge: Node<"float"> } {
  const radius = BASALT_BLOCK_RADIUS;
  const spacing = vec2(Math.sqrt(3) * radius, 3 * radius);
  const a = ground.sub(ground.div(spacing).round().mul(spacing));
  const staggered = ground.sub(spacing.mul(0.5));
  const b = staggered.sub(staggered.div(spacing).round().mul(spacing));
  const delta = a.dot(a).lessThanEqual(b.dot(b)).select(a, b);
  const blockCenter = ground.sub(delta);
  const row = blockCenter.y.div(1.5 * radius).round();
  const col = blockCenter.x
    .div(Math.sqrt(3) * radius)
    .sub(row.mul(0.5))
    .round();
  // Bound the arithmetic for stable signed-coordinate hashes on both graphics backends.
  const q = col.mod(97).add(97).mod(97);
  const r = row.mod(89).add(89).mod(89);
  const variation = q.mul(114).add(r.mul(218)).add(q.mul(r).mul(17)).mod(251).div(251);
  const gapVariation = q.mul(37).add(r.mul(83)).add(q.mul(r).mul(11)).mod(251).div(251);
  const distance = delta.x
    .abs()
    .max(
      delta.x
        .mul(0.5)
        .add(delta.y.mul(Math.sqrt(3) / 2))
        .abs(),
    )
    .max(
      delta.x
        .mul(-0.5)
        .add(delta.y.mul(Math.sqrt(3) / 2))
        .abs(),
    );
  // Individual regular hexagons retain their shape; only the narrow joint width varies.
  // Derivatives antialias the fixed world-space edge rather than changing its width with zoom.
  const inset = gapVariation.mul(0.006).add(0.008);
  const slabEdge = float(radius)
    .sub(inset)
    .mul(Math.sqrt(3) / 2);
  const pixel = fwidth(distance).mul(0.5).max(0.0001);
  const slab = smoothstep(slabEdge.sub(pixel), slabEdge.add(pixel), distance).oneMinus();
  const stone = vec3(0.035, 0.04, 0.049).mul(variation.mul(0.3).add(0.85));
  return {
    color: mix(vec3(0.011, 0.014, 0.02), stone, slab),
    // Outer mineral traces dissolve into their host biome instead of ending in hard polygon edges.
    softEdge: smoothstep((radius * Math.sqrt(3)) / 2 - 0.045, (radius * Math.sqrt(3)) / 2, distance).oneMinus(),
  };
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
