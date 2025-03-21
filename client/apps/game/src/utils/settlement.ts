import { Position } from "@/types/position";
import { SettlementLocation } from "@/ui/components/settlement/settlement-types";

// Settlement constants
export const SETTLEMENT_CENTER = 2147483646;
export const SETTLEMENT_BASE_DISTANCE = 30;
export const SETTLEMENT_SUBSEQUENT_DISTANCE = 10;


/**
 * Calculates the total capacity of realms that can be settled up to a given layer
 * @param layer Maximum layer to calculate capacity for
 * @returns Total capacity of realms
 */
export function calculateLayerCapacity(layer: number): number {
  if (layer <= 0) return 0;

  // Layer 1 has 5 points
  if (layer === 1) return 5;

  // Each additional layer adds 6 * layer points
  let capacity = 5; // Start with layer 1 capacity
  for (let i = 2; i <= layer; i++) {
    capacity += 6 * i;
  }

  return capacity;
}

/**
 * Converts settlement location to a Position object
 * @param location Settlement location
 * @returns Position object
 */
export function settlementLocationToPosition(location: SettlementLocation): Position {
  return new Position({ x: location.x, y: location.y });
}

/**
 * Determines the maximum layer based on the number of realms
 * @param realmCount Number of realms
 * @returns Maximum layer
 */
export function getMaxLayer(realmCount: number): number {
  if (realmCount <= 1500) return 26; // 2105 capacity
  if (realmCount <= 2500) return 32; // 3167 capacity
  if (realmCount <= 3500) return 37; // 4217 capacity
  if (realmCount <= 4500) return 41; // 5165 capacity
  if (realmCount <= 5500) return 45; // 6209 capacity
  if (realmCount <= 6500) return 49; // 7349 capacity
  return 52; // 8267 capacity
}
