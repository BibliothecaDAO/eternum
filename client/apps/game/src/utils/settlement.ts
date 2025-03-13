import { Position } from "@/types/position";
import { SettlementLocation } from "@/ui/components/settlement/settlement-types";

// Settlement constants
export const SETTLEMENT_CENTER = 2147483646;
export const SETTLEMENT_BASE_DISTANCE = 30;
export const SETTLEMENT_SUBSEQUENT_DISTANCE = 10;

/**
 * Generates all possible settlement locations based on the settlement config
 * @param maxLayers Maximum number of layers to generate
 * @returns Array of all possible settlement locations
 */
export function generateSettlementLocations(maxLayers: number): SettlementLocation[] {
  const locations: SettlementLocation[] = [];

  // Center coordinates (this should match the center in the backend)
  const center = SETTLEMENT_CENTER;
  const baseDistance = SETTLEMENT_BASE_DISTANCE;
  const subsequentDistance = SETTLEMENT_SUBSEQUENT_DISTANCE;

  // Generate locations for each layer, side, and point
  for (let layer = 1; layer <= maxLayers; layer++) {
    const distanceFromCenter = baseDistance + (layer - 1) * subsequentDistance;

    for (let side = 0; side < 6; side++) {
      // Calculate max points on this side
      const maxPoints = side > 0 ? layer : layer - 1;

      for (let point = 0; point <= maxPoints; point++) {
        // Calculate the coordinates based on the settlement config algorithm
        const sideAngle = (side * Math.PI) / 3;
        const nextSideAngle = (((side + 1) % 6) * Math.PI) / 3;

        // Calculate start and end coordinates for this side
        const startX = center + distanceFromCenter * Math.cos(sideAngle);
        const startY = center + distanceFromCenter * Math.sin(sideAngle);
        const endX = center + distanceFromCenter * Math.cos(nextSideAngle);
        const endY = center + distanceFromCenter * Math.sin(nextSideAngle);

        // Calculate position along the side based on point
        const posPercentage = (point + 1) / (maxPoints + 1);
        const x = startX + (endX - startX) * posPercentage;
        const y = startY + (endY - startY) * posPercentage;

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
 * Calculates the maximum number of points on a side for a given layer
 * @param side Side number (0-5)
 * @param layer Layer number (1+)
 * @returns Maximum number of points on the side
 */
export function maxSidePoints(side: number, layer: number): number {
  return side > 0 ? layer : layer - 1;
}

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
