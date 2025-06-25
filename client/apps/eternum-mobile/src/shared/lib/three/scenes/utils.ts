import * as THREE from "three";

export interface HexPosition {
  col: number;
  row: number;
}

export const HEX_SIZE = 1;

export const getWorldPositionForHex = (hexCoords: HexPosition, flat: boolean = true) => {
  const hexRadius = HEX_SIZE; // This represents height/2
  const hexHeight = hexRadius * 2;
  const hexWidth = hexHeight * 1.6; // width = height * 1.6
  const sideLength = hexHeight / 2; // tile side length = height / 2

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
  return new THREE.Vector3(x, y, z);
};

export const getWorldPositionForTile = (hexCoords: HexPosition, flat: boolean = true) => {
  const hexRadius = HEX_SIZE; // This represents height/2
  const hexHeight = hexRadius * 2;
  const hexWidth = hexHeight * 1.6; // width = height * 1.6
  const sideLength = hexHeight / 2; // tile side length = height / 2

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
  return new THREE.Vector3(x, y, z);
};

export const getHexForWorldPosition = (worldPosition: { x: number; y: number; z: number }): HexPosition => {
  const hexRadius = HEX_SIZE; // This represents height/2
  const hexHeight = hexRadius * 2;
  const hexWidth = hexHeight * 1.6; // width = height * 1.6
  const sideLength = hexHeight / 2; // tile side length = height / 2

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

const pseudoRandom = (x: number, y: number) => {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453123;
  return n - Math.floor(n);
};

export const getHexagonCoordinates = (
  instancedMesh: THREE.InstancedMesh,
  instanceId: number,
): { hexCoords: HexPosition; position: THREE.Vector3 } => {
  const matrix = new THREE.Matrix4();
  instancedMesh.getMatrixAt(instanceId, matrix);
  const position = new THREE.Vector3();
  matrix.decompose(position, new THREE.Quaternion(), new THREE.Vector3());

  const hexCoords = getHexForWorldPosition(position);

  return { hexCoords, position };
};
