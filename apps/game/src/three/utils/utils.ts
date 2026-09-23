import { useAccountStore } from "@/hooks/store/use-account-store";
import { ContractAddress } from "@bibliothecadao/types";
export { configureGltfTextureSupport, gltfLoader, loadKtx2Texture } from "./gltf-loader";

export function createPausedLabel() {
  const div = document.createElement("div");
  div.classList.add("rounded-md", "bg-brown/50", "text-gold", "p-1", "-translate-x-1/2", "text-xs");
  div.textContent = `⚠️ Production paused`;
  return div;
}

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

import { calculateDistance } from "@bibliothecadao/eternum";
import { HexPosition, Position } from "@bibliothecadao/types";
import { Vector3 } from "three";
import { HEX_SIZE } from "../constants";
import { worldHexAt, worldHexToWorld } from "../world-origin";
import { latticeHexAt, latticeToWorld } from "./hex-lattice";

export const hashCoordinates = (x: number, y: number): number => {
  // Simple hash function to generate a deterministic value between 0 and 1
  const hash = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return hash - Math.floor(hash);
};

const placeOnLattice = (world: { x: number; z: number }, flat: boolean, out: Vector3): Vector3 =>
  out.set(world.x, flat ? 0 : pseudoRandom(world.x, world.z) * 2, world.z);

/** Where a normalized world-map hex is drawn, through the world map's floating origin. */
export const getWorldPositionForHex = (hexCoords: HexPosition, flat: boolean = true): Vector3 =>
  placeOnLattice(worldHexToWorld(hexCoords.col, hexCoords.row), flat, new Vector3());

export const getWorldPositionForHexCoordsInto = (
  col: number,
  row: number,
  out: Vector3,
  flat: boolean = true,
): Vector3 => placeOnLattice(worldHexToWorld(col, row), flat, out);

/** The normalized world-map hex under a drawn point. */
export const getHexForWorldPosition = (worldPosition: { x: number; y: number; z: number }): HexPosition =>
  worldHexAt(worldPosition.x, worldPosition.z);

/**
 * How a scene turns its hexes into drawn positions and back. The world map goes through its floating origin; the
 * local realm scene draws its own building lattice, which the world origin must never move.
 */
export interface HexSpace {
  positionForHex(hex: HexPosition, flat?: boolean): Vector3;
  positionForHexInto(col: number, row: number, out: Vector3, flat?: boolean): Vector3;
  hexForPosition(point: { x: number; y: number; z: number }): HexPosition;
}

export const WORLD_HEX_SPACE: HexSpace = {
  positionForHex: getWorldPositionForHex,
  positionForHexInto: getWorldPositionForHexCoordsInto,
  hexForPosition: getHexForWorldPosition,
};

export const LOCAL_HEX_SPACE: HexSpace = {
  positionForHex: (hex, flat = true) => placeOnLattice(latticeToWorld(hex.col, hex.row), flat, new Vector3()),
  positionForHexInto: (col, row, out, flat = true) => placeOnLattice(latticeToWorld(col, row), flat, out),
  hexForPosition: (point) => latticeHexAt(point.x, point.z),
};

export const calculateDistanceInHexes = (
  start: Pick<Position, "x" | "y">,
  destination: Pick<Position, "x" | "y">,
): number | undefined => {
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
