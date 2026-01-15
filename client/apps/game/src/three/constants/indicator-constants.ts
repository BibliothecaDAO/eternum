import { ModelType } from "../types/army";

/**
 * Visual configuration for player indicator dots
 */

// Indicator dot size (world units, diameter)
export const INDICATOR_SIZE = 0.4;

// Indicator opacity (0.0 to 1.0)
export const INDICATOR_OPACITY = 0.9;

// Render order (render after units but before UI)
export const INDICATOR_RENDER_ORDER = 10;

// Sphere geometry segments (low-poly for performance)
export const INDICATOR_SEGMENTS_WIDTH = 8;
export const INDICATOR_SEGMENTS_HEIGHT = 6;

/**
 * Y-offset (height above ground) for indicator dots per model type
 * Values are calibrated to position dots above each unit's bounding box
 */
export const INDICATOR_Y_OFFSETS: Record<ModelType, number> = {
  // Knights - Standard humanoid height with armor
  [ModelType.Knight1]: 3,
  [ModelType.Knight2]: 3,
  [ModelType.Knight3]: 3,

  // Crossbowmen - Slightly shorter stance
  [ModelType.Crossbowman1]: 3,
  [ModelType.Crossbowman2]: 3,
  [ModelType.Crossbowman3]: 3,

  // Paladins - Larger models with heavy armor
  [ModelType.Paladin1]: 2.8,
  [ModelType.Paladin2]: 3.0,
  [ModelType.Paladin3]: 3.2,

  // Boat - Low profile on water surface
  [ModelType.Boat]: 3.2,

  // Agent models - Standard AI agent height
  [ModelType.AgentApix]: 2.5,
  [ModelType.AgentElisa]: 2.5,
  [ModelType.AgentIstarai]: 2.5,
  [ModelType.AgentYP]: 2.5,
};

/**
 * Get the Y-offset for a given model type
 * Falls back to default offset if model type not found
 */
export function getIndicatorYOffset(modelType: ModelType): number {
  return INDICATOR_Y_OFFSETS[modelType] || 2.5;
}
