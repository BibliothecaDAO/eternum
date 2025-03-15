import { Position } from "@/types/position";
import { ClientComponents, ContractAddress, Coord, HexDirection, StructureType } from "@bibliothecadao/eternum";
import { getComponentValue, HasValue, runQuery } from "@dojoengine/recs";
import {
  SETTLEMENT_BASE_DISTANCE,
  SETTLEMENT_CENTER,
  SETTLEMENT_SUBSEQUENT_DISTANCE
} from "./settlement-constants";
import { SettlementLocation } from "./settlement-types";


/**
 * Calculate the distance from center for a given layer
 */
export const layerDistanceFromCenter = (layer: number): number => {
  return SETTLEMENT_BASE_DISTANCE + ((layer - 1) * SETTLEMENT_SUBSEQUENT_DISTANCE);
};

/**
 * Calculate the maximum number of points on a side for a given layer
 */
export const maxPointsInLayer = (layer: number): number => {
  return layer - 1;
};


export const sideDirections = (side: number): HexDirection[] => {
  const start_directions = [
    [HexDirection.East, HexDirection.NorthWest],
    [HexDirection.East, HexDirection.SouthWest],
    [HexDirection.West, HexDirection.NorthEast],
    [HexDirection.West, HexDirection.SouthEast],
    [HexDirection.SouthWest, HexDirection.East],
    [HexDirection.NorthEast, HexDirection.West],
  ];
  return start_directions[side]
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
export function generateSettlementLocations(maxLayers: number): [SettlementLocation[], Map<string, {side: number, layer: number, point: number}>] {
  const locations: SettlementLocation[] = [];
  const locations_map = new Map<string, {side: number, layer: number, point: number}>();
  const center = new Coord (SETTLEMENT_CENTER, SETTLEMENT_CENTER);

  // Generate locations for each layer, side, and point
  for (let layer = 1; layer <= maxLayers; layer++) {
    for (let side = 0; side < 6; side++) {
        const start_direction = sideDirections(side)[0];
        const triangle_direction = sideDirections(side)[1];
        // Calculate max points on this side
        const maxPoints = maxPointsInLayer(layer);
        for (let point = 0; point < maxPoints; point++) {

          let first_structure_coord = center;
          for(let i = 0; i < SETTLEMENT_BASE_DISTANCE; i++) {
            first_structure_coord = first_structure_coord.neighbor(start_direction);
          }
          for(let i = 0; i < SETTLEMENT_BASE_DISTANCE / 2; i++) {
            first_structure_coord = first_structure_coord.neighbor(triangle_direction);
          }

          let first_structure_after_distance = first_structure_coord;
          for(let i = 0; i < SETTLEMENT_SUBSEQUENT_DISTANCE * (layer - 1) ; i++) {
            first_structure_after_distance = first_structure_after_distance.neighbor(start_direction);
          }

          let destination_coord = first_structure_after_distance;
          for(let i = 0; i < SETTLEMENT_SUBSEQUENT_DISTANCE * point ; i++) {
            destination_coord = destination_coord.neighbor(triangle_direction);
          }


          locations_map.set(`${destination_coord.x},${destination_coord.y}`, 
            {side, layer, point}); 
  
          locations.push({
            side,
            layer,
            point,
            x: destination_coord.x,
            y: destination_coord.y,
          });
      }
    }
  }

  return [locations, locations_map];
}

/**
 * Gets all occupied locations from the game state
 */
export const getOccupiedLocations = (playerAddress: ContractAddress, components: ClientComponents, locations_map: Map<string, {side: number, layer: number, point: number}>) => {
  const realmEntities = runQuery([HasValue(components.Structure, { category: StructureType.Realm })]);
  const realmPositions = Array.from(realmEntities).map((entity) => {
    const structure = getComponentValue(components.Structure, entity);
    if (structure) {
      const x = structure?.base.coord_x;
      const y = structure?.base.coord_y;

      // Use the improved reverse calculation function
      const location = locations_map.get(`${x},${y}`);
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
