import { FELT_CENTER as SETTLEMENT_CENTER } from "@/ui/config";
import { StructureType } from "@bibliothecadao/types";
import { configManager } from "@bibliothecadao/eternum";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
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
export const getBanksLocations = (store: NativeFactStore): SettlementLocation[] =>
  [...store.inGame("Structure", configManager.getActiveGameId())]
    .filter((structure) => structure.base.category === StructureType.Bank)
    .map((structure) => coordinatesToSettlementLocation(structure.base.coord_x, structure.base.coord_y));
