import useStore from "@/shared/store";
import { ContractAddress, getNeighborHexes, HexPosition } from "@bibliothecadao/types";
import * as THREE from "three";
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
  return BigInt(address) === BigInt(ContractAddress(useStore.getState().account?.address || "0"));
}

export function loggedInAccount(): ContractAddress {
  return ContractAddress(useStore.getState().account?.address || "0");
}

export const HEX_SIZE = 1;

export const getWorldPositionForHex = (hexCoords: HexPosition, flat: boolean = true, output?: THREE.Vector3) => {
  const hexRadius = HEX_SIZE; // This represents height/2
  const hexHeight = hexRadius * 2;
  const hexWidth = hexHeight * 1.6; // width = height * 1.6
  //const sideLength = hexHeight / 2; // tile side length = height / 2

  // For isometric hexagons, we need different spacing calculations
  // Vertical distance between row centers
  const vertDist = hexHeight * 0.75; // This remains similar for proper row spacing
  // Horizontal distance between column centers
  const horizDist = hexWidth; // Adjusted for the wider hexagons

  const col = hexCoords.col;
  const row = hexCoords.row;
  const rowOffset = ((row % 2) * Math.sign(row) * horizDist) / 2;
  const x = col * horizDist - rowOffset;
  const z = row * vertDist;
  const y = flat ? 0 : pseudoRandom(x, z) * 2;

  if (output) {
    output.set(x, y, z);
    return output;
  }

  return new THREE.Vector3(x, y, z);
};

export const getWorldPositionForTile = (hexCoords: HexPosition, flat: boolean = true, output?: THREE.Vector3) => {
  const hexRadius = HEX_SIZE; // This represents height/2
  const hexHeight = hexRadius * 2;
  const hexWidth = hexHeight * 1.6; // width = height * 1.6
  //const sideLength = hexHeight / 2; // tile side length = height / 2

  // For isometric hexagons, we need different spacing calculations
  // Vertical distance between row centers
  const vertDist = hexHeight * 0.75; // This remains similar for proper row spacing
  // Horizontal distance between column centers
  const horizDist = hexWidth; // Adjusted for the wider hexagons

  const col = hexCoords.col;
  const row = hexCoords.row;
  const rowOffset = ((row % 2) * Math.sign(row) * horizDist) / 2;
  const x = col * horizDist - rowOffset;
  const z = row * vertDist;
  const y = flat ? 0 : pseudoRandom(x, z) * 2;

  if (output) {
    output.set(x, y, z);
    return output;
  }

  return new THREE.Vector3(x, y, z);
};

export const getHexForWorldPosition = (worldPosition: { x: number; y: number; z: number }): HexPosition => {
  const hexRadius = HEX_SIZE; // This represents height/2
  const hexHeight = hexRadius * 2;
  const hexWidth = hexHeight * 1.6; // width = height * 1.6
  //const _sideLength = hexHeight / 2; // tile side length = height / 2

  // For isometric hexagons, we need different spacing calculations
  // Vertical distance between row centers
  const vertDist = hexHeight * 0.75; // This remains similar for proper row spacing
  // Horizontal distance between column centers
  const horizDist = hexWidth; // Adjusted for the wider hexagons

  const row = Math.round(worldPosition.z / vertDist);
  const rowOffset = ((row % 2) * Math.sign(row) * horizDist) / 2;
  const col = Math.round((worldPosition.x + rowOffset) / horizDist);

  return {
    col,
    row,
  };
};

export const pseudoRandom = (x: number, y: number) => {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453123;
  return n - Math.floor(n);
};

// Reusable objects for getHexagonCoordinates
const tempMatrix = new THREE.Matrix4();
const tempPosition = new THREE.Vector3();
const tempQuaternion = new THREE.Quaternion();
const tempScale = new THREE.Vector3();

export const getHexagonCoordinates = (
  instancedMesh: THREE.InstancedMesh,
  instanceId: number,
): { hexCoords: HexPosition; position: THREE.Vector3 } => {
  instancedMesh.getMatrixAt(instanceId, tempMatrix);
  tempMatrix.decompose(tempPosition, tempQuaternion, tempScale);

  const hexCoords = getHexForWorldPosition(tempPosition);

  return { hexCoords, position: tempPosition.clone() };
};
export const generateHexPositions = (center: HexPosition, radius: number) => {
  const positions: any[] = [];
  const positionSet = new Set(); // To track existing positions

  // Helper function to add position if not already added
  const addPosition = (col: number, row: number, isBorder: boolean) => {
    const key = `${col},${row}`;
    if (!positionSet.has(key)) {
      const position = {
        col,
        row,
        isBorder,
      };
      positions.push(position);
      positionSet.add(key);
    }
  };

  // Add center position
  addPosition(center.col, center.row, false);

  // Generate positions in expanding hexagonal layers
  let currentLayer = [center];
  for (let i = 0; i < radius; i++) {
    const nextLayer: any = [];
    currentLayer.forEach((pos) => {
      getNeighborHexes(pos.col, pos.row).forEach((neighbor) => {
        if (!positionSet.has(`${neighbor.col},${neighbor.row}`)) {
          addPosition(neighbor.col, neighbor.row, i === radius - 1);
          nextLayer.push({ col: neighbor.col, row: neighbor.row });
        }
      });
    });
    currentLayer = nextLayer; // Move to the next layer
  }

  return positions;
};
