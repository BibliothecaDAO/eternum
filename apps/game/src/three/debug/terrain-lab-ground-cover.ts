import {
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  IcosahedronGeometry,
  type InstancedMesh,
} from "three";
import { mix, positionLocal, time, transformNormalToView, uv, vec3 } from "three/tsl";
import { MeshStandardNodeMaterial } from "three/webgpu";

import type { ProceduralTerrain } from "../terrain/procedural-terrain";
import { terrainBiomeTones } from "../terrain/terrain-palette";
import { TERRAIN_LAB_DRESSING } from "./terrain-lab-dressing";
import { createScatter, type GroundTile } from "./terrain-lab-trials";

/** The ground things are scattered on: its tiles, and the height they stand at. */
export interface DressedGround {
  terrain: ProceduralTerrain;
  tiles: readonly GroundTile[];
  heightAt: (x: number, z: number) => number;
}

const BLADE = { width: 0.034, shortest: 0.45, lean: 0.3, curve: 0.22, rows: 3 };
const LEAF = { smallest: 0.035, largest: 0.075, lift: 0.006, curl: 0.5 };
const STONE = { smallest: 0.07, largest: 0.16, flatness: 0.6, sunk: 0.3 };

/** Blades of grass standing on the ground and swaying in the wind, in each tile's own green. */
export function createBlades(ground: DressedGround): InstancedMesh | null {
  const tint = new Color();
  return createScatter({
    name: "terrain-lab-blades",
    geometry: createBladeGeometry(),
    material: createBladeMaterial(),
    ...ground,
    seed: 0x9e3779b1,
    countOf: (biome) => TERRAIN_LAB_DRESSING[biome].blades,
    place: (blade, colour, spot) => {
      const { random } = spot;
      const tallest = TERRAIN_LAB_DRESSING[spot.biome].bladeHeight;
      blade.position.set(spot.x, spot.y, spot.z);
      blade.rotation.set((random() - 0.5) * BLADE.lean, random() * Math.PI * 2, (random() - 0.5) * BLADE.lean, "YXZ");
      blade.scale.set(1, tallest * spot.clearance * (BLADE.shortest + random() * (1 - BLADE.shortest)), 1);
      const tones = terrainBiomeTones(spot.biome);
      colour
        .copy(tones.body)
        .lerp(tint.copy(tones.light), random() * 0.6)
        .multiplyScalar(0.85 + random() * 0.3);
    },
  });
}

/** Fallen leaves and needles lying on the forest floor. */
export function createLeaves(ground: DressedGround): InstancedMesh | null {
  const dark = new Color();
  return createScatter({
    name: "terrain-lab-leaves",
    geometry: createLeafGeometry(),
    material: new MeshStandardNodeMaterial({ metalness: 0, roughness: 0.85, side: DoubleSide }),
    ...ground,
    seed: 0x85ebca77,
    countOf: (biome) => TERRAIN_LAB_DRESSING[biome].leaves,
    place: (leaf, colour, spot) => {
      const { random } = spot;
      leaf.position.set(spot.x, spot.y + LEAF.lift, spot.z);
      leaf.rotation.set((random() - 0.5) * LEAF.curl, random() * Math.PI * 2, (random() - 0.5) * LEAF.curl, "YXZ");
      leaf.scale.setScalar(LEAF.smallest + random() * (LEAF.largest - LEAF.smallest));
      colour.set(TERRAIN_LAB_DRESSING[spot.biome].leafTint);
      colour.lerp(dark.copy(colour).multiplyScalar(0.5), random() * 0.7).multiplyScalar(0.8 + random() * 0.5);
    },
  });
}

/** Stones of every size, half sunk in the ground, each cut with its own flat faces. */
export function createStones(ground: DressedGround): InstancedMesh | null {
  const light = new Color();
  const material = new MeshStandardNodeMaterial({ metalness: 0, roughness: 0.95, flatShading: true });
  const stones = createScatter({
    name: "terrain-lab-stones",
    geometry: new IcosahedronGeometry(1, 0),
    material,
    ...ground,
    seed: 0xc2b2ae3d,
    countOf: (biome) => TERRAIN_LAB_DRESSING[biome].stones,
    place: (stone, colour, spot) => {
      const { random } = spot;
      const size = STONE.smallest + random() * random() * (STONE.largest - STONE.smallest);
      stone.position.set(spot.x, spot.y + size * (STONE.flatness - STONE.sunk), spot.z);
      stone.rotation.set(random() * Math.PI, random() * Math.PI, random() * Math.PI);
      stone.scale.set(size * (0.8 + random() * 0.5), size * STONE.flatness, size * (0.8 + random() * 0.5));
      const tones = terrainBiomeTones(TERRAIN_LAB_DRESSING[spot.biome].stoneTones);
      colour.copy(tones.shadow).lerp(light.copy(tones.light), random());
    },
  });
  if (stones) {
    stones.castShadow = true;
    stones.receiveShadow = true;
  }
  return stones;
}

/** One blade: a tapering strip standing on its root, curving forward toward its tip. */
function createBladeGeometry(): BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let row = 0; row < BLADE.rows; row += 1) {
    const along = row / BLADE.rows;
    const half = (BLADE.width / 2) * (1 - along * 0.75);
    const forward = along * along * BLADE.curve;
    positions.push(-half, along, forward, half, along, forward);
    uvs.push(0, along, 1, along);
  }
  positions.push(0, 1, BLADE.curve);
  uvs.push(0.5, 1);
  for (let row = 0; row < BLADE.rows - 1; row += 1) {
    const left = row * 2;
    indices.push(left, left + 1, left + 2, left + 1, left + 3, left + 2);
  }
  const last = (BLADE.rows - 1) * 2;
  indices.push(last, last + 1, last + 2);
  return createGeometry(positions, uvs, indices);
}

/** One leaf: a pointed oval lying flat, of length one. */
function createLeafGeometry(): BufferGeometry {
  const positions = [0, 0, -0.5, 0.28, 0, 0, 0, 0, 0.5, -0.28, 0, 0];
  const uvs = [0.5, 0, 1, 0.5, 0.5, 1, 0, 0.5];
  return createGeometry(positions, uvs, [0, 2, 1, 0, 3, 2]);
}

function createGeometry(positions: number[], uvs: number[], indices: number[]): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createBladeMaterial(): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial({ metalness: 0, roughness: 0.9, side: DoubleSide });
  material.name = "terrain-lab-blades";
  const up = uv().y;
  const gust = time.mul(1.8).add(positionLocal.x.mul(1.1)).add(positionLocal.z.mul(0.8));
  const sway = vec3(gust.sin().mul(0.045), 0, gust.mul(0.7).cos().mul(0.03));
  material.positionNode = positionLocal.add(sway.mul(up.mul(up)));
  material.colorNode = mix(vec3(0.5, 0.56, 0.48), vec3(1.2, 1.16, 1), up);
  // Blades are lit as the ground they stand on, so a field reads as one surface and not as thousands of slivers.
  material.normalNode = transformNormalToView(vec3(0, 1, 0));
  return material;
}
