import { useAccountStore } from "@/hooks/store/use-account-store";
import { ContractAddress } from "@bibliothecadao/types";
import { HexPosition } from "@bibliothecadao/types";
import { InstancedMesh, Quaternion, Vector3 } from "three";
import { DRACOLoader, GLTFLoader, MeshoptDecoder } from "three-stdlib";

import { MatrixPool } from "./matrix-pool";
import { getHexForWorldPosition } from "./hex-world-position";

export {
  calculateDistanceInHexes,
  getHexForWorldPosition,
  getWorldPositionForHex,
  getWorldPositionForHexCoordsInto,
} from "./hex-world-position";

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

const normalizeAddressToBigInt = (address: unknown): bigint | undefined => {
  if (typeof address === "bigint") {
    return address;
  }

  if (typeof address === "string") {
    const normalized = address.trim();
    if (normalized.length === 0) {
      return undefined;
    }
    try {
      return BigInt(normalized);
    } catch {
      return undefined;
    }
  }

  return undefined;
};

export function isAddressEqualToAccount(address: bigint | string | null | undefined): boolean {
  const normalizedAddress = normalizeAddressToBigInt(address);
  if (normalizedAddress === undefined) {
    return false;
  }

  const normalizedAccount = normalizeAddressToBigInt(useAccountStore.getState().account?.address) ?? 0n;
  return normalizedAddress === normalizedAccount;
}

function loggedInAccount(): ContractAddress {
  return ContractAddress(useAccountStore.getState().account?.address || "0");
}

export const hashCoordinates = (x: number, y: number): number => {
  // Simple hash function to generate a deterministic value between 0 and 1
  const hash = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return hash - Math.floor(hash);
};

const _matrixDecomposePos = new Vector3();
const _matrixDecomposeQuat = new Quaternion();
const _matrixDecomposeScale = new Vector3();

const getHexagonCoordinates = (
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
