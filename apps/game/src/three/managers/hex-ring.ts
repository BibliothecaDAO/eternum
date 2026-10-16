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

/**
 * One copy of a flat ring shape on every centre, in world space, each vertex set on the ground under it: any number of
 * rings is one geometry and one draw.
 */
export function drapeHexRingCopies(
  shape: THREE.BufferGeometry,
  centres: readonly { x: number; z: number }[],
  terrain: TerrainSurface,
  lift: number,
): THREE.BufferGeometry {
  const source = shape.getAttribute("position");
  const positions = new Float32Array(centres.length * source.count * 3);
  centres.forEach((centre, copy) => {
    for (let vertex = 0; vertex < source.count; vertex++) {
      const x = centre.x + source.getX(vertex);
      const z = centre.z - source.getY(vertex);
      const offset = (copy * source.count + vertex) * 3;
      positions[offset] = x;
      positions[offset + 1] = terrain.sampleSurface(x, z).height + lift;
      positions[offset + 2] = z;
    }
  });
  const geometry = new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const index = shape.getIndex();
  if (index) {
    const indices = new Uint32Array(centres.length * index.count);
    for (let copy = 0; copy < centres.length; copy++)
      for (let entry = 0; entry < index.count; entry++)
        indices[copy * index.count + entry] = index.getX(entry) + copy * source.count;
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  }
  geometry.computeBoundingSphere();
  return geometry;
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

/** Six samples along each straight hex edge, so a draped ring follows curved shores and relief. */
function hexagonPoints(radius: number): THREE.Vector2[] {
  const points: THREE.Vector2[] = [];
  for (let edge = 0; edge < 6; edge++) {
    const angle = (Math.PI / 3) * edge - Math.PI / 2;
    const nextAngle = angle + Math.PI / 3;
    const start = new THREE.Vector2(radius * Math.cos(angle), radius * Math.sin(angle));
    const end = new THREE.Vector2(radius * Math.cos(nextAngle), radius * Math.sin(nextAngle));
    for (let step = 0; step < 6; step++) points.push(start.clone().lerp(end, step / 6));
  }
  return points;
}
