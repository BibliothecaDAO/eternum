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
import * as THREE from "three";
import { HEX_SIZE } from "../constants";
import { MatrixPool } from "./matrix-pool";

export const hashCoordinates = (x: number, y: number): number => {
  // Simple hash function to generate a deterministic value between 0 and 1
  const hash = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return hash - Math.floor(hash);
};

export const getHexagonCoordinates = (
  instancedMesh: THREE.InstancedMesh,
  instanceId: number,
): { hexCoords: HexPosition; position: THREE.Vector3 } => {
  const matrixPool = MatrixPool.getInstance();
  const matrix = matrixPool.getMatrix();
  instancedMesh.getMatrixAt(instanceId, matrix);
  const position = new THREE.Vector3();
  matrix.decompose(position, new THREE.Quaternion(), new THREE.Vector3());

  const hexCoords = getHexForWorldPosition(position);

  // Release matrix back to pool
  matrixPool.releaseMatrix(matrix);

  return { hexCoords, position };
};

export const getWorldPositionForHex = (hexCoords: HexPosition, flat: boolean = true) => {
  const hexRadius = HEX_SIZE;
  const hexHeight = hexRadius * 2;
  const hexWidth = Math.sqrt(3) * hexRadius;
  const vertDist = hexHeight * 0.75;
  const horizDist = hexWidth;

  const col = hexCoords.col;
  const row = hexCoords.row;
  const rowOffset = ((row % 2) * Math.sign(row) * horizDist) / 2;
  const x = col * horizDist - rowOffset;
  const z = row * vertDist;
  const y = flat ? 0 : pseudoRandom(x, z) * 2;
  return new THREE.Vector3(x, y, z);
};

export const getHexForWorldPosition = (worldPosition: { x: number; y: number; z: number }): HexPosition => {
  const hexRadius = HEX_SIZE;
  const hexHeight = hexRadius * 2;
  const hexWidth = Math.sqrt(3) * hexRadius;
  const vertDist = hexHeight * 0.75;
  const horizDist = hexWidth;

  const row = Math.round(worldPosition.z / vertDist);
  // hexception offsets hack
  const rowOffset = ((row % 2) * Math.sign(row) * horizDist) / 2;
  const col = Math.round((worldPosition.x + rowOffset) / horizDist);

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
