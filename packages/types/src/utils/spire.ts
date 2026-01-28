/**
 * Spire utility functions for calculating spire positions on the alternate map.
 *
 * Spires are placed in a hexagonal pattern:
 * - Position 0: Center spire
 * - Layer 1 has 6 spires (1 per side): positions 1-6
 * - Layer 2 has 12 spires (2 per side): positions 7-18
 * - Layer 3 has 18 spires (3 per side): positions 19-36
 * - Layer N has 6*N spires (N per side)
 */

export interface SpirePosition {
  layer: number;
  side: number;
  point: number;
}

/**
 * Convert a settled count to a spire position (layer, side, point).
 *
 * @param settledCount - The current number of spires already settled (0-indexed count)
 * @returns The position for the next spire to be placed
 */
export function settledCountToPosition(settledCount: number): SpirePosition {
  if (settledCount <= 0) {
    return { layer: 0, side: 0, point: 0 };
  }

  // Subtract 1 for the center
  let remaining = settledCount - 1;

  // Find which layer we're in
  let layer = 1;
  let cumulative = 6; // 6 * 1

  while (remaining >= cumulative) {
    remaining -= cumulative;
    layer += 1;
    cumulative = 6 * layer;
  }

  // remaining is the position within this layer (0 to 6*layer - 1)
  // Each layer has `layer` points per side, and 6 sides
  // We iterate: all sides for point 0, then all sides for point 1, etc.
  const point = Math.floor(remaining / 6);
  const side = remaining % 6;

  return { layer, side, point };
}

/**
 * Calculate how many spires can fit in a given number of layers.
 *
 * @param layers - Number of layers (excluding center)
 * @returns Total number of spires that can fit (including center)
 */
export function getTotalSpiresInLayers(layers: number): number {
  // Center + sum of 6*i for i=1 to layers = 1 + 6*(1+2+...+layers) = 1 + 6*layers*(layers+1)/2
  return 1 + 3 * layers * (layers + 1);
}

/**
 * Calculate which layer a given spire count would be in.
 *
 * @param settledCount - The number of spires already settled
 * @returns The layer number (0 for center, 1+ for outer layers)
 */
export function getLayerForSettledCount(settledCount: number): number {
  if (settledCount <= 0) {
    return 0;
  }
  const position = settledCountToPosition(settledCount);
  return position.layer;
}
