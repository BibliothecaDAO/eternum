import { HEX_SIZE } from "@/three/constants";
import type { TerrainSurface } from "@/three/terrain/terrain-surface";
import * as THREE from "three";

/**
 * The world map's hex ring: a glow band, a softer halo around it and a crisp outline, drawn in one colour. The hover
 * draws one; the ownership highlight draws one on every hex a player holds. Every layer stays inside its hex so
 * neighbouring cliffs cannot split or lift it.
 */
export interface HexRingMaterials {
  glow: THREE.MeshBasicMaterial;
  halo: THREE.MeshBasicMaterial;
  outline: THREE.LineBasicMaterial;
}

/** Flat ring shapes in the ground plane (x, y), centred on the origin: a mesh rotated onto the ground draws them. */
export interface HexRingShapes {
  glow: THREE.BufferGeometry;
  halo: THREE.BufferGeometry;
  outline: THREE.BufferGeometry;
}

/** How high above the ground each layer floats, so the three never fight for depth. */
export const HEX_RING_LIFT = { glow: 0.03, halo: 0.028, outline: 0.035 } as const;

export function createHexRingShapes(): HexRingShapes {
  return {
    glow: createBandGeometry(HEX_SIZE * 0.98, HEX_SIZE * 0.9),
    halo: createBandGeometry(HEX_SIZE * 0.995, HEX_SIZE * 0.87),
    outline: createOutlineGeometry(HEX_SIZE * 0.97),
  };
}

export function createHexRingMaterials(): HexRingMaterials {
  const glow = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide });
  const halo = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide });
  const outline = new THREE.LineBasicMaterial({ transparent: true, depthWrite: false });
  for (const material of [glow, halo, outline]) material.toneMapped = false;
  return { glow, halo, outline };
}

/** Colours the ring and sets its strength (0–1); a pulse (0.88–1) breathes it while it is shown. */
export function applyHexRingLook(
  materials: HexRingMaterials,
  color: THREE.Color,
  intensity: number,
  pulse?: number,
): void {
  materials.glow.color.copy(color);
  materials.halo.color.copy(color);
  materials.outline.color.copy(color);
  if (pulse === undefined) {
    materials.glow.opacity = 0.26 + intensity * 0.1;
    materials.halo.opacity = 0.12 + intensity * 0.08;
    materials.outline.opacity = Math.min(1, 0.9 + intensity * 0.08);
    return;
  }
  materials.glow.opacity = 0.22 + intensity * 0.14 + pulse * 0.04;
  materials.halo.opacity = 0.1 + intensity * 0.12 + pulse * 0.05;
  materials.outline.opacity = Math.min(1, 0.88 + intensity * 0.12 + pulse * 0.03);
}

export function layOnGround(
  shape: THREE.BufferGeometry,
  copies: readonly GroundCopy[],
  terrain: TerrainSurface,
  lift: number,
): THREE.BufferGeometry {
  const source = shape.getAttribute("position");
  const geometry = new THREE.BufferGeometry().setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(copies.length * source.count * 3), 3),
  );
  copies.forEach((copy, index) => layCopyOnGround(geometry, index, shape, copy, terrain, lift));
  const colors = shape.getAttribute("color");
  if (colors) {
    const replicated = new Float32Array(copies.length * colors.count * colors.itemSize);
    for (let copy = 0; copy < copies.length; copy++) replicated.set(colors.array, copy * colors.array.length);
    geometry.setAttribute("color", new THREE.BufferAttribute(replicated, colors.itemSize));
  }
  const index = shape.getIndex();
  if (index) {
    const indices = new Uint32Array(copies.length * index.count);
    for (let copy = 0; copy < copies.length; copy++)
      for (let entry = 0; entry < index.count; entry++)
        indices[copy * index.count + entry] = index.getX(entry) + copy * source.count;
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  }
  geometry.computeBoundingSphere();
  return geometry;
}

export interface GroundCopy {
  x: number;
  z: number;
  scale?: number;
}

export function layCopyOnGround(
  geometry: THREE.BufferGeometry,
  copyIndex: number,
  shape: THREE.BufferGeometry,
  copy: GroundCopy,
  terrain: TerrainSurface,
  lift: number,
): void {
  const source = shape.getAttribute("position");
  const target = geometry.getAttribute("position");
  const scale = copy.scale ?? 1;
  const y = terrain.sampleHeight(copy.x, copy.z) + lift;
  for (let vertex = 0; vertex < source.count; vertex++) {
    target.setXYZ(
      copyIndex * source.count + vertex,
      copy.x + source.getX(vertex) * scale,
      y,
      copy.z - source.getY(vertex) * scale,
    );
  }
  target.needsUpdate = true;
}

function createBandGeometry(outerRadius: number, innerRadius: number): THREE.BufferGeometry {
  const outer = hexagonPoints(outerRadius);
  const inner = hexagonPoints(innerRadius);
  const positions: number[] = [];
  const indices: number[] = [];
  for (let index = 0; index < outer.length; index++) {
    positions.push(outer[index].x, outer[index].y, 0, inner[index].x, inner[index].y, 0);
    const start = index * 2;
    const next = ((index + 1) % outer.length) * 2;
    indices.push(start, next, start + 1, next, next + 1, start + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  return geometry;
}

function createOutlineGeometry(radius: number): THREE.BufferGeometry {
  const points = hexagonPoints(radius);
  const positions: number[] = [];
  for (let index = 0; index < points.length; index++) {
    const next = points[(index + 1) % points.length];
    positions.push(points[index].x, points[index].y, 0, next.x, next.y, 0);
  }
  return new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
}

function hexagonPoints(radius: number): THREE.Vector2[] {
  return Array.from({ length: 6 }, (_, corner) => {
    const angle = (Math.PI / 3) * corner - Math.PI / 2;
    return new THREE.Vector2(radius * Math.cos(angle), radius * Math.sin(angle));
  });
}
