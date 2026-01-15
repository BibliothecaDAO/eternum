import { sqlApi } from "@/services/api";
import { FELT_CENTER as SETTLEMENT_CENTER } from "@/ui/config";
import { Coord, Position } from "@bibliothecadao/eternum";
import { ClientComponents, ContractAddress, Direction, StructureType } from "@bibliothecadao/types";
import { getComponentValue, HasValue, runQuery } from "@dojoengine/recs";
import { SETTLEMENT_BASE_DISTANCE, SETTLEMENT_SUBSEQUENT_DISTANCE } from "../constants/settlement-constants";
import { SettlementLocation } from "./settlement-types";

/**
 * Calculate the maximum number of points on a side for a given layer
 */
const maxPointsInLayer = (layer: number): number => {
  return layer - 1;
};

const sideLayerXFirstCoord = (side: number, layer: number): Coord => {
  const start_direction = sideDirections(side)[0];
  const side_first_coord_layer_0 = sideLayerOneFirstCoord(side);
  let side_first_coord_layer_x = side_first_coord_layer_0;
  for (let i = 0; i < SETTLEMENT_SUBSEQUENT_DISTANCE * (layer - 1); i++) {
    side_first_coord_layer_x = side_first_coord_layer_x.neighbor(start_direction);
  }

  return side_first_coord_layer_x;
};

const sideLayerOneFirstCoord = (side: number): Coord => {
  const center = new Coord(SETTLEMENT_CENTER(), SETTLEMENT_CENTER());
  const start_direction = sideDirections(side)[0];
  const triangle_direction = sideDirections(side)[1];
  let side_first_coord_layer_0 = center;
  for (let i = 0; i < SETTLEMENT_BASE_DISTANCE; i++) {
    side_first_coord_layer_0 = side_first_coord_layer_0.neighbor(start_direction);
  }

  for (let i = 0; i < SETTLEMENT_BASE_DISTANCE / 2; i++) {
    side_first_coord_layer_0 = side_first_coord_layer_0.neighbor(triangle_direction);
  }
  return side_first_coord_layer_0;
};

const sideDirections = (side: number): Direction[] => {
  const start_directions = [
    [Direction.EAST, Direction.NORTH_WEST],
    [Direction.EAST, Direction.SOUTH_WEST],
    [Direction.WEST, Direction.NORTH_EAST],
    [Direction.WEST, Direction.SOUTH_EAST],
    [Direction.SOUTH_EAST, Direction.WEST],
    [Direction.NORTH_EAST, Direction.WEST],
  ];
  return start_directions[side];
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
export function generateSettlementLocations(
  maxLayers: number,
): [SettlementLocation[], Map<string, { side: number; layer: number; point: number }>] {
  const locations: SettlementLocation[] = [];
  const locations_map = new Map<string, { side: number; layer: number; point: number }>();

  // Generate locations for each layer, side, and point
  for (let layer = 1; layer <= maxLayers; layer++) {
    for (let side = 0; side < 6; side++) {
      // Calculate max points on this side
      const maxPoints = maxPointsInLayer(layer);
      const triangle_direction = sideDirections(side)[1];
      for (let point = 0; point < maxPoints; point++) {
        const side_first_coord_layer_x = sideLayerXFirstCoord(side, layer);
        let destination_coord = side_first_coord_layer_x;
        for (let i = 0; i < SETTLEMENT_SUBSEQUENT_DISTANCE * point; i++) {
          destination_coord = destination_coord.neighbor(triangle_direction);
        }

        locations_map.set(`${destination_coord.x},${destination_coord.y}`, { side, layer, point });

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
export const getOccupiedLocations = async (
  playerAddress: ContractAddress,
  locations_map: Map<string, { side: number; layer: number; point: number }>,
): Promise<SettlementLocation[]> => {
  try {
    const settlements = await sqlApi.fetchRealmSettlements();
    const realmPositions = settlements.map((entity) => {
      const x = entity.coord_x;
      const y = entity.coord_y;

      // Use the improved reverse calculation function
      const location = locations_map.get(`${x},${y}`);

      if (!location) return null;

      return {
        side: location.side,
        layer: location.layer,
        point: location.point,
        x,
        y,
        isMine: BigInt(entity.owner) === BigInt(playerAddress),
      } as SettlementLocation;
    });

    return realmPositions.filter((position): position is SettlementLocation => position !== null);
  } catch (error) {
    console.error("Failed to fetch settlements:", error);
    return [];
  }
};

/**
 * Converts coordinates to settlement location (layer, side, point)
 * This is the reverse of the forward calculation in generateSettlementLocations
 * and matches the backend implementation more closely
 */
const coordinatesToSettlementLocation = (x: number, y: number): SettlementLocation => {
  // Calculate distance from center
  const dx = x - SETTLEMENT_CENTER();
  const dy = y - SETTLEMENT_CENTER();
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
