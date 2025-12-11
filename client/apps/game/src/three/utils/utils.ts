import { useAccountStore } from "@/hooks/store/use-account-store";
import { ContractAddress } from "@bibliothecadao/types";
import { DRACOLoader, GLTFLoader, MeshoptDecoder } from "three-stdlib";

export function createPausedLabel() {
  const div = document.createElement("div");
  div.classList.add("rounded-md", "bg-brown/50", "text-gold", "p-1", "-translate-x-1/2", "text-xs");
  div.textContent = `⚠️ Production paused`;
  return div;
}

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
dracoLoader.preload();

export const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);
gltfLoader.setMeshoptDecoder(MeshoptDecoder());

export function isAddressEqualToAccount(address: bigint): boolean {
  return BigInt(address) === BigInt(useAccountStore.getState().account?.address || "0");
}

export function loggedInAccount(): ContractAddress {
  return ContractAddress(useAccountStore.getState().account?.address || "0");
}

import { calculateDistance } from "@bibliothecadao/eternum";
import { HexPosition, Position } from "@bibliothecadao/types";
import { InstancedMesh, Quaternion, Vector3 } from "three";
import { HEX_SIZE } from "../constants";
import { MatrixPool } from "./matrix-pool";

export const hashCoordinates = (x: number, y: number): number => {
  // Simple hash function to generate a deterministic value between 0 and 1
  const hash = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return hash - Math.floor(hash);
};

const _matrixDecomposePos = new Vector3();
const _matrixDecomposeQuat = new Quaternion();
const _matrixDecomposeScale = new Vector3();

export const getHexagonCoordinates = (
  instancedMesh: InstancedMesh,
  instanceId: number,
): { hexCoords: HexPosition; position: Vector3 } => {
  const matrixPool = MatrixPool.getInstance();
  const matrix = matrixPool.getMatrix();
  instancedMesh.getMatrixAt(instanceId, matrix);

  // Use shared objects for decomposition to avoid garbage creation
  matrix.decompose(_matrixDecomposePos, _matrixDecomposeQuat, _matrixDecomposeScale);

  const position = new Vector3().copy(_matrixDecomposePos);
  const hexCoords = getHexForWorldPosition(position);

  // Release matrix back to pool
  matrixPool.releaseMatrix(matrix);

  return { hexCoords, position };
};

export const getWorldPositionForHex = (hexCoords: HexPosition, flat: boolean = true) => {
  const out = new Vector3();
  return getWorldPositionForHexCoordsInto(hexCoords.col, hexCoords.row, out, flat);
};

// Precomputed hex spacing constants for hot-path helpers.
const HEX_RADIUS = HEX_SIZE;
const HEX_HEIGHT = HEX_RADIUS * 2;
const HEX_WIDTH = Math.sqrt(3) * HEX_RADIUS;
const VERT_DIST = HEX_HEIGHT * 0.75;
const HORIZ_DIST = HEX_WIDTH;

/**
 * Non-allocating hex -> world conversion.
 * Writes into `out` and returns it.
 */
export const getWorldPositionForHexCoordsInto = (
  col: number,
  row: number,
  out: Vector3,
  flat: boolean = true,
) => {
  const rowOffset = ((row % 2) * Math.sign(row) * HORIZ_DIST) / 2;
  const x = col * HORIZ_DIST - rowOffset;
  const z = row * VERT_DIST;
  const y = flat ? 0 : pseudoRandom(x, z) * 2;
  out.set(x, y, z);
  return out;
};

export const getWorldPositionForHexInto = (hexCoords: HexPosition, out: Vector3, flat: boolean = true) => {
  return getWorldPositionForHexCoordsInto(hexCoords.col, hexCoords.row, out, flat);
};

export const getHexForWorldPosition = (worldPosition: { x: number; y: number; z: number }): HexPosition => {
  const row = Math.round(worldPosition.z / VERT_DIST);
  // hexception offsets hack
  const rowOffset = ((row % 2) * Math.sign(row) * HORIZ_DIST) / 2;
  const col = Math.round((worldPosition.x + rowOffset) / HORIZ_DIST);

  return {
    col,
    row,
  };
};

export const calculateDistanceInHexes = (start: Position, destination: Position): number | undefined => {
  const distance = calculateDistance(start, destination);
  if (distance) {
    return Math.round(distance / HEX_SIZE / 2);
  }
  return undefined;
};

const pseudoRandom = (x: number, y: number) => {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453123;
  return n - Math.floor(n);
};
