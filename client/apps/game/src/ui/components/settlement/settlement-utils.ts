import { Position } from "@/types/position";
import { ClientComponents, ContractAddress, StructureType } from "@bibliothecadao/eternum";
import { getComponentValue, HasValue, runQuery } from "@dojoengine/recs";
import {
  PI,
  SETTLEMENT_BASE_DISTANCE,
  SETTLEMENT_CENTER,
  SETTLEMENT_SUBSEQUENT_DISTANCE,
} from "./settlement-constants";
import { SettlementLocation } from "./settlement-types";

/**
 * Calculate the distance from center for a given layer
 */
export const layerDistanceFromCenter = (layer: number): number => {
  return SETTLEMENT_BASE_DISTANCE + (layer - 1) * SETTLEMENT_SUBSEQUENT_DISTANCE;
};

/**
 * Calculate the maximum number of points on a side for a given layer
 */
export const maxSidePoints = (layer: number): number => {
  return layer;
};

/**
 * Calculate the percentage position on a side
 */
const getPosPercentage = (pointOnSide: number, maxPointsOnSide: number): number => {
  return (pointOnSide + 1) / (maxPointsOnSide + 1);
};

/**
 * Calculate the coordinates for a point on a side
 */
export const sideCoordinate = (side: number, distanceFromCenter: number): { x: number; y: number } => {
  const angle = (side * PI) / 3;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const x = SETTLEMENT_CENTER + distanceFromCenter * cos;
  const y = SETTLEMENT_CENTER + distanceFromCenter * sin;
  return { x, y };
};

/**
 * Convert normalized coordinates to contract coordinates
 */
export const normalizedToContractCoords = (x: number | string, y: number | string): { x: number; y: number } => {
  // Convert string values to numbers, defaulting to 0 if empty or just a negative sign
  const normalizedX = typeof x === "string" && (x === "" || x === "-") ? 0 : Number(x);
  const normalizedY = typeof y === "string" && (y === "" || y === "-") ? 0 : Number(y);

  return new Position({ x: normalizedX, y: normalizedY }).getContract();
};

/**
 * Generates all possible settlement locations based on the settlement config
 */
export function generateSettlementLocations(maxLayers: number): SettlementLocation[] {
  const locations: SettlementLocation[] = [];

  // Generate locations for each layer, side, and point
  for (let layer = 1; layer <= maxLayers; layer++) {
    const distanceFromCenter = layerDistanceFromCenter(layer);

    for (let side = 0; side < 6; side++) {
      // Calculate max points on this side
      const maxPoints = maxSidePoints(layer);

      for (let point = 0; point < maxPoints; point++) {
        // Calculate the coordinates based on the settlement config algorithm
        const startCoord = sideCoordinate(side, distanceFromCenter);
        const nextSide = (side + 1) % 6;
        const posPercentage = getPosPercentage(point, maxPoints);
        const endCoord = sideCoordinate(nextSide, distanceFromCenter);

        // Calculate position along the side based on point and ensure it's an integer
        const x = Math.round(startCoord.x + (endCoord.x - startCoord.x) * posPercentage);
        const y = Math.round(startCoord.y + (endCoord.y - startCoord.y) * posPercentage);

        locations.push({
          side,
          layer,
          point,
          x,
          y,
        });
      }
    }
  }

  return locations;
}

/**
 * Gets all occupied locations from the game state
 */
export const getOccupiedLocations = (playerAddress: ContractAddress, components: ClientComponents) => {
  const realmEntities = runQuery([HasValue(components.Structure, { category: StructureType.Realm })]);
  const realmPositions = Array.from(realmEntities).map((entity) => {
    const structure = getComponentValue(components.Structure, entity);
    if (structure) {
      const x = structure?.base.coord_x;
      const y = structure?.base.coord_y;

      // Use the improved reverse calculation function
      const location = coordinatesToSettlementLocation(x, y);
      const isMine = structure?.owner === playerAddress;

      return {
        ...location,
        isMine,
      };
    }
    return null;
  });
  console.log({ realmPositions });
  return realmPositions.filter((position) => position !== null) as SettlementLocation[];
};

/**
 * Gets all bank locations from the game state
 */
export const getBanksLocations = (components: ClientComponents) => {
  const bankEntities = runQuery([HasValue(components.Structure, { category: StructureType.Bank })]);
  const bankPositions = Array.from(bankEntities).map((entity) => {
    const structure = getComponentValue(components.Structure, entity);
    if (structure) {
      const x = structure?.base.coord_x;
      const y = structure?.base.coord_y;

      // Use the improved reverse calculation function
      return coordinatesToSettlementLocation(x, y);
    }
    return null;
  });
  return bankPositions.filter((position) => position !== null) as SettlementLocation[];
};

/**
 * Converts coordinates to settlement location (layer, side, point)
 * This is the reverse of the forward calculation in generateSettlementLocations
 * and matches the backend implementation more closely
 */
export const coordinatesToSettlementLocation = (x: number, y: number): SettlementLocation => {
  // Calculate distance from center
  const dx = x - SETTLEMENT_CENTER;
  const dy = y - SETTLEMENT_CENTER;
  const distance = Math.sqrt(dx * dx + dy * dy);

  // Calculate layer based on distance
  const layer = Math.round((distance - SETTLEMENT_BASE_DISTANCE) / SETTLEMENT_SUBSEQUENT_DISTANCE) + 1;

  // Calculate angle in radians
  let angle = Math.atan2(dy, dx);
  if (angle < 0) angle += 2 * Math.PI;

  // Convert angle to side (6 sides, starting from right going counterclockwise)
  const side = Math.floor((angle * 6) / (2 * Math.PI));

  // Calculate point based on position between sides
  const angleInSide = angle - (side * Math.PI) / 3;
  const point = Math.floor((layer * angleInSide) / (Math.PI / 3));

  return {
    side,
    layer,
    point,
    x,
    y,
  };
};
