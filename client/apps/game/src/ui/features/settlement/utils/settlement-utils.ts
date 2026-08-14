import { FELT_CENTER as SETTLEMENT_CENTER } from "@/ui/config";
import { ClientComponents, StructureType } from "@bibliothecadao/types";
import { getComponentValue, HasValue, runQuery } from "@dojoengine/recs";
import { SETTLEMENT_BASE_DISTANCE, SETTLEMENT_SUBSEQUENT_DISTANCE } from "../constants/settlement-constants";
import { SettlementLocation } from "./settlement-types";

/**
 * Converts coordinates to settlement location (layer, side, point)
 * Matches the backend settlement layout closely.
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
