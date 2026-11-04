import { createInstancedMesh } from "../utils/create-instanced-mesh";
import type { EtherealLayer } from "@bibliothecadao/eternum";
import { BufferGeometry, Float32BufferAttribute, InstancedMesh, Matrix4, Vector3 } from "three";
import { color, positionWorld } from "three/tsl";
import { MeshStandardNodeMaterial } from "three/webgpu";
import { applyEndgameFrost } from "../effects/endgame/field";
import { BASALT_SUPPORT_HEIGHT } from "./terrain-basalt";
import { terrainHexToWorld, terrainNeighborCoordinates } from "./terrain-coordinates";
import { hashTerrainCoordinates, terrainHashToUnitFloat } from "./terrain-hash";
import { ETHEREAL_DEPTH_LOOKS } from "./ethereal-depths";
import type { TerrainCellInput } from "./terrain-types";

export function createDepthMineralResources(depth: EtherealLayer) {
  const look = ETHEREAL_DEPTH_LOOKS[depth];
  const geometry = createMineralGeometry(look.shape);
  geometry.userData.sharedTerrain = true;
  const material = new MeshStandardNodeMaterial({
    roughness: 0.75,
    emissive: look.energy,
    emissiveIntensity: look.shape === "crystal" ? 0.12 : 0,
  });
  const grain = positionWorld.x
    .mul(37)
    .add(positionWorld.z.mul(29))
    .add(positionWorld.y.mul(43))
    .sin()
    .mul(0.07)
    .add(0.93);
  material.colorNode = applyEndgameFrost(color(look.stone).mul(grain));
  return { geometry, material };
}

/** One compact instanced cluster draw per depth on a page. Ground truth and occupancy own its lifetime. */
export function createDepthMinerals(
  cells: readonly TerrainCellInput[],
  depth: EtherealLayer,
  resources: ReturnType<typeof createDepthMineralResources>,
): InstancedMesh {
  const mesh = createInstancedMesh(resources.geometry, resources.material, cells.length);
  mesh.name = `ethereal-depth-${depth}-minerals`;
  mesh.userData.etherealDepth = depth;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function writeDepthMinerals(
  mesh: InstancedMesh,
  cells: readonly TerrainCellInput[],
  depth: EtherealLayer,
  isBlocked: (col: number, row: number) => boolean,
): void {
  const look = ETHEREAL_DEPTH_LOOKS[depth];
  let count = 0;
  for (const cell of cells) {
    if (
      !cell.explored ||
      !cell.biome ||
      cell.surfacePresentation !== depth ||
      cell.occupied ||
      isBlocked(cell.col, cell.row)
    )
      continue;
    if (terrainNeighborCoordinates(cell.col, cell.row).some((p) => isBlocked(p.col, p.row))) continue;
    const seed = terrainHashToUnitFloat(
      hashTerrainCoordinates({
        col: cell.col,
        row: cell.row,
        elevationSeed: 137,
        moistureSeed: 991,
        salt: "ethereal-minerals",
      }),
    );
    if (seed > look.density) continue;
    const point = terrainHexToWorld(cell.col, cell.row);
    const height = look.height * (0.6 + seed / look.density);
    const width = look.shape === "shelf" ? 1.7 : 0.7;
    const matrix = new Matrix4().makeRotationY(seed * 30).scale(new Vector3(width, height, width));
    matrix.setPosition(point.x + 0.48, BASALT_SUPPORT_HEIGHT + height / 2, point.z - 0.4);
    mesh.setMatrixAt(count++, matrix);
  }
  mesh.count = count;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
}

/** Three joined, chipped mineral sections form a cluster, with flat faces and uneven broken tops. */
function createMineralGeometry(shape: string): BufferGeometry {
  if (shape !== "shelf" && shape !== "crystal" && shape !== "column")
    throw new Error(`Unknown depth mineral shape: ${shape}`);
  const positions: number[] = [];
  const indices: number[] = [];
  const crystal = shape === "crystal";
  const pieces = [
    { x: 0, z: 0, height: 1, radius: crystal ? 0.16 : 0.27 },
    { x: 0.22, z: 0.07, height: 0.58, radius: crystal ? 0.12 : 0.21 },
    { x: -0.14, z: -0.19, height: 0.42, radius: crystal ? 0.1 : 0.18 },
  ];
  for (const [pieceIndex, piece] of pieces.entries()) {
    const start = positions.length / 3;
    const rings = crystal
      ? [
          [0, 0.8],
          [0.74, 1],
          [1, 0.06],
        ]
      : [
          [0, 0.85],
          [0.14, 1],
          [0.85, 0.9],
          [1, 0.65],
        ];
    for (const [height, radius] of rings) {
      for (let side = 0; side < 6; side++) {
        const angle = (side * Math.PI) / 3 + pieceIndex * 0.6;
        const chip = 0.84 + 0.16 * Math.sin(side * 7.3 + pieceIndex);
        positions.push(
          piece.x + Math.cos(angle) * radius * piece.radius * chip + height * (crystal ? 0.09 : 0.02),
          -0.5 + height * piece.height * (0.9 + 0.1 * Math.cos(side * 2.4 + pieceIndex)),
          piece.z + Math.sin(angle) * radius * piece.radius * chip,
        );
      }
    }
    for (let ring = 0; ring < rings.length - 1; ring++)
      for (let side = 0; side < 6; side++) {
        const a = start + ring * 6 + side,
          b = start + ring * 6 + ((side + 1) % 6);
        indices.push(a, a + 6, b, b, a + 6, b + 6);
      }
    const top = start + (rings.length - 1) * 6;
    for (let side = 1; side < 5; side++) indices.push(top, top + side + 1, top + side);
  }
  const indexed = new BufferGeometry();
  indexed.setAttribute("position", new Float32BufferAttribute(positions, 3));
  indexed.setIndex(indices);
  const geometry = indexed.toNonIndexed();
  indexed.dispose();
  geometry.computeVertexNormals();
  return geometry;
}
